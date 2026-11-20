import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps, LegacyStackSynthesizer, Tags } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface BackendProps extends StackProps {
  /** OIDC subject 접두사. 이 저장소는 불변 subject를 쓰므로 `repo:miceplans@<orgId>/miceplaner@<repoId>` 형식이다(`gh api repos/<repo>/actions/oidc/customization/sub`). main 브랜치 Actions만 배포 역할을 맡을 수 있다. */
  githubSubjectPrefix: string;
  /** 계정에 이미 있는 GitHub Actions OIDC 공급자 ARN. */
  githubOidcProviderArn: string;
  /** `com.amazonaws.global.cloudfront.origin-facing` 관리형 접두사 목록 ID(리전별). */
  cloudFrontPrefixListId: string;
  instanceType?: string;
}

const REALTIME_PORT = 3400;
const COLLAB_PORT = 3300;
const PARAM_PATH = '/miceplans/prod';

/**
 * 상시 프로세스(realtime·collab·worker)를 EC2 한 대의 Docker로 돌린다 (ADR: 서버 비용 최소화).
 * - 공개 서브넷만 쓰는 새 VPC(NAT 없음)와 CloudFront 접두사 목록만 허용하는 보안 그룹. 도메인·ALB 없이 CloudFront가 HTTPS/WSS를 맡는다.
 * - 비밀은 SSM Parameter Store(`/miceplans/prod/*`, SecureString)에 두고 배포 때 인스턴스가 읽어 `.env`로 만든다.
 * - GitHub Actions(OIDC)가 ECR에 이미지를 올리고 SSM Run Command로 배포한다. SSH는 열지 않는다.
 */
export class BackendStack extends Stack {
  constructor(scope: Construct, id: string, props: BackendProps) {
    super(scope, id, { ...props, synthesizer: new LegacyStackSynthesizer() });
    Tags.of(this).add('Project', 'miceplans');
    Tags.of(this).add('ManagedBy', 'cdk');

    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.50.0.0/16'),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
    });

    const sg = new ec2.SecurityGroup(this, 'Sg', { vpc, description: 'miceplans backend: CloudFront origin only', allowAllOutbound: true });
    // 접두사 목록은 규칙 55개로 계산되므로 포트 범위 규칙 하나로 둔다.
    sg.addIngressRule(ec2.Peer.prefixList(props.cloudFrontPrefixListId), ec2.Port.tcpRange(COLLAB_PORT, REALTIME_PORT), 'CloudFront origin-facing');

    const repo = new ecr.Repository(this, 'Images', {
      repositoryName: 'miceplans',
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 12, description: '최근 이미지 12개만 보관' }],
    });

    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    repo.grantPull(role);
    role.addToPolicy(new iam.PolicyStatement({ actions: ['ssm:GetParametersByPath', 'ssm:GetParameters', 'ssm:GetParameter'], resources: [`arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${PARAM_PATH}*`] }));
    // worker가 읽고 쓰는 업로드 원본 저장소. 비공개·암호화·TLS 전용이며 스택을 지워도 데이터는 남긴다.
    const uploads = new s3.Bucket(this, 'Uploads', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    uploads.grantReadWrite(role);
    new ssm.StringParameter(this, 'S3BucketParam', { parameterName: `${PARAM_PATH}/S3_BUCKET`, stringValue: uploads.bucketName });
    new ssm.StringParameter(this, 'S3RegionParam', { parameterName: `${PARAM_PATH}/S3_REGION`, stringValue: this.region });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euo pipefail',
      'dnf install -y docker jq',
      'systemctl enable --now docker',
      // docker compose 플러그인
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      'curl -fsSL https://github.com/docker/compose/releases/download/v2.39.4/docker-compose-linux-aarch64 -o /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',
      // 메모리가 작아 스왑 1GB를 둔다.
      'fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo "/swapfile none swap sw 0 0" >> /etc/fstab',
      'mkdir -p /opt/miceplans && chmod 755 /opt/miceplans',
      `cat > /opt/miceplans/compose.yml <<'EOF'
services:
  realtime:
    image: \${IMAGE_REALTIME:-busybox}
    restart: always
    env_file: .env
    ports: ["${REALTIME_PORT}:${REALTIME_PORT}"]
    mem_limit: 256m
  collab:
    image: \${IMAGE_COLLAB:-busybox}
    restart: always
    env_file: .env
    ports: ["${COLLAB_PORT}:${COLLAB_PORT}"]
    mem_limit: 320m
  worker:
    image: \${IMAGE_WORKER:-busybox}
    restart: always
    env_file: .env
    mem_limit: 320m
EOF`,
      // deploy.sh <service> <image>: 비밀을 SSM에서 읽어 .env를 만들고 해당 서비스만 새 이미지로 올린다.
      `cat > /opt/miceplans/deploy.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
service="$1"; image="$2"
case "$service" in realtime|collab|worker) ;; *) echo "unknown service: $service" >&2; exit 2;; esac
cd /opt/miceplans
region="$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)" http://169.254.169.254/latest/meta-data/placement/region)"
umask 077
aws ssm get-parameters-by-path --region "$region" --path ${PARAM_PATH}/ --with-decryption --query 'Parameters[].[Name,Value]' --output json \\
  | jq -r '.[] | "\\(.[0] | split("/") | last)=\\(.[1])"' > .env.new
mv .env.new .env
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "\${image%%/*}"
key="IMAGE_$(echo "$service" | tr a-z A-Z)"
touch images.env; grep -v "^$key=" images.env > images.env.new || true
echo "$key=$image" >> images.env.new; mv images.env.new images.env
docker compose --env-file images.env -f compose.yml pull "$service"
docker compose --env-file images.env -f compose.yml up -d "$service"
docker image prune -f >/dev/null
EOF`,
      'chmod 700 /opt/miceplans/deploy.sh',
    );

    const instance = new ec2.Instance(this, 'Host', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType ?? 't4g.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup: sg,
      role,
      userData,
      requireImdsv2: true,
      associatePublicIpAddress: true,
      blockDevices: [{ deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }) }],
    });
    // 중지·재시작해도 CloudFront 원본 주소가 바뀌지 않도록 고정 IP를 붙인다.
    const eip = new ec2.CfnEIP(this, 'Ip', { instanceId: instance.instanceId });
    const originDomain = Fn.join('', ['ec2-', Fn.join('-', Fn.split('.', eip.ref)), `.${this.region}.compute.amazonaws.com`]);

    const distribution = (name: string, port: number) =>
      new cloudfront.Distribution(this, name, {
        comment: `miceplans ${name}`,
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        defaultBehavior: {
          origin: new origins.HttpOrigin(originDomain, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, httpPort: port, readTimeout: Duration.seconds(60), keepaliveTimeout: Duration.seconds(60) }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      });
    const realtimeCdn = distribution('Realtime', REALTIME_PORT);
    const collabCdn = distribution('Collab', COLLAB_PORT);

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      description: 'GitHub Actions (main) pushes ECR images and deploys via SSM',
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(props.githubOidcProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com', 'token.actions.githubusercontent.com:sub': `${props.githubSubjectPrefix}:ref:refs/heads/main` },
      }),
    });
    repo.grantPullPush(deployRole);
    deployRole.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:SendCommand'],
      resources: [`arn:${this.partition}:ec2:${this.region}:${this.account}:instance/${instance.instanceId}`, `arn:${this.partition}:ssm:${this.region}::document/AWS-RunShellScript`],
    }));
    deployRole.addToPolicy(new iam.PolicyStatement({ actions: ['ssm:GetCommandInvocation', 'ssm:ListCommandInvocations'], resources: ['*'] }));

    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'RepositoryUri', { value: repo.repositoryUri });
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'RealtimeUrl', { value: `https://${realtimeCdn.distributionDomainName}` });
    new CfnOutput(this, 'CollabUrl', { value: `https://${collabCdn.distributionDomainName}` });
    new CfnOutput(this, 'UploadsBucket', { value: uploads.bucketName });
    new CfnOutput(this, 'ParameterPath', { value: PARAM_PATH });
  }
}
