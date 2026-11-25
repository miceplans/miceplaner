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
  /** 임베딩(TEI) 전용 인스턴스 유형. BGE-M3(fp32)는 메모리 2.5~3GB가 필요해 4GB 이상이어야 한다. */
  embedInstanceType?: string;
}

const REALTIME_PORT = 3400;
const COLLAB_PORT = 3300;
const PARAM_PATH = '/miceplans/prod';
const HOST_AMI = 'ami-04eb46ea118fea29a';
const EMBED_PORT = 8080;
/** TEI arm64 CPU 이미지(2026-11-24 기준 cpu-arm64-1.9). 태그가 바뀌어도 같은 이미지를 쓰도록 다이제스트로 고정한다. */
const TEI_IMAGE = 'ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9@sha256:798cd7615e060a72ccbdf19aa0ada52289c6a0147490195bafaece6ce04d70f1';
/** BGE-M3 모델 리비전. 바꾸면 기존 벡터와 호환되지 않으므로 전체 재임베딩(백필)이 필요하다. */
const BGE_M3_REVISION = '5617a9f61b028005a4858fdac845db406aefb181';

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
    // Vercel API 함수(업로드·다운로드)용 사용자. AWS 역할을 맡을 수 없어 접근 키를 쓰며, 업로드 키 접두사(events/)만 다룬다.
    // 접근 키는 CloudFormation 출력에 남지 않도록 스택 밖에서 발급해 Vercel 환경 변수에만 둔다(infra/README.md).
    const apiFilesUser = new iam.User(this, 'ApiFilesUser');
    apiFilesUser.addToPolicy(new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'], resources: [uploads.arnForObjects('events/*')] }));
    // 없는 키를 AccessDenied가 아닌 NoSuchKey로 받으려면 목록 권한이 필요하다.
    apiFilesUser.addToPolicy(new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [uploads.bucketArn], conditions: { StringLike: { 's3:prefix': ['events/*'] } } }));
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
      // Amazon Linux 2023 arm64를 고정한다. 최신 AMI 조회를 쓰면 무관한 변경을 배포할 때도 인스턴스가 교체된다. AMI를 올릴 때만 바꾼다.
      machineImage: ec2.MachineImage.genericLinux({ 'ap-northeast-2': HOST_AMI }),
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

    // ── 임베딩(TEI, BGE-M3) 전용 인스턴스 ─────────────────────────────────────
    // 공용 호스트(t4g.micro, 1GB)에는 모델이 올라가지 않아 따로 둔다(2026-11-24 결정, 월 약 $30).
    // Vercel API(질의 임베딩)와 worker(문서 임베딩)가 함께 쓰므로 CloudFront HTTPS로 열고, TEI `--api-key`로 막는다.
    // 키는 SSM SecureString `${PARAM_PATH}/TEI_API_KEY`에 운영자가 넣는다(CloudFormation은 SecureString을 만들 수 없다).
    const embedSg = new ec2.SecurityGroup(this, 'EmbedSg', { vpc, description: 'miceplans embeddings: CloudFront origin only', allowAllOutbound: true });
    embedSg.addIngressRule(ec2.Peer.prefixList(props.cloudFrontPrefixListId), ec2.Port.tcp(EMBED_PORT), 'CloudFront origin-facing');
    const embedRole = new iam.Role(this, 'EmbedInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    // 다른 운영 비밀은 읽지 않는다. API 키 하나만 허용한다.
    embedRole.addToPolicy(new iam.PolicyStatement({ actions: ['ssm:GetParameter'], resources: [`arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${PARAM_PATH}/TEI_API_KEY`] }));

    const embedUserData = ec2.UserData.forLinux();
    embedUserData.addCommands(
      'set -euo pipefail',
      'dnf install -y docker',
      'systemctl enable --now docker',
      // 모델 적재 순간의 메모리 여유를 위해 스왑 2GB를 둔다.
      'fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo "/swapfile none swap sw 0 0" >> /etc/fstab',
      'mkdir -p /opt/tei/data && chmod 700 /opt/tei',
      // --max-batch-tokens 기본값(16384)은 워밍업에서 4GB를 넘겨 OOM(137)으로 죽는다. 4096이면 상주 약 3.5GB로 뜬다(2026-11-24 실측).
      // 시작할 때마다 SSM에서 키를 읽는다. 키가 아직 없으면 systemd가 30초 뒤 다시 시도하므로 스택 배포와 키 등록 순서가 자유롭다.
      `cat > /opt/tei/start.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
token="$(curl -s -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
region="$(curl -s -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/placement/region)"
umask 077
key="$(aws ssm get-parameter --region "$region" --name ${PARAM_PATH}/TEI_API_KEY --with-decryption --query Parameter.Value --output text)"
printf 'API_KEY=%s\\n' "$key" > /opt/tei/env
docker rm -f tei >/dev/null 2>&1 || true
exec docker run --rm --name tei --env-file /opt/tei/env -p ${EMBED_PORT}:80 -v /opt/tei/data:/data --memory 3584m \\
  ${TEI_IMAGE} \\
  --model-id BAAI/bge-m3 --revision ${BGE_M3_REVISION} --max-client-batch-size 32 --max-batch-tokens 4096
EOF`,
      'chmod 700 /opt/tei/start.sh',
      `cat > /etc/systemd/system/tei.service <<'EOF'
[Unit]
Description=Text Embeddings Inference (BGE-M3)
After=docker.service network-online.target
Requires=docker.service

[Service]
ExecStart=/opt/tei/start.sh
ExecStop=/usr/bin/docker stop tei
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF`,
      'systemctl daemon-reload',
      'systemctl enable --now tei.service',
    );

    const embedInstance = new ec2.Instance(this, 'EmbedHost', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.embedInstanceType ?? 't4g.medium'),
      machineImage: ec2.MachineImage.genericLinux({ 'ap-northeast-2': HOST_AMI }),
      securityGroup: embedSg,
      role: embedRole,
      userData: embedUserData,
      requireImdsv2: true,
      associatePublicIpAddress: true,
      // 이미지(약 1GB)와 모델 캐시(약 2.3GB)를 두고도 여유 있게 잡는다.
      blockDevices: [{ deviceName: '/dev/xvda', volume: ec2.BlockDeviceVolume.ebs(30, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }) }],
    });
    const embedEip = new ec2.CfnEIP(this, 'EmbedIp', { instanceId: embedInstance.instanceId });
    const embedOrigin = Fn.join('', ['ec2-', Fn.join('-', Fn.split('.', embedEip.ref)), `.${this.region}.compute.amazonaws.com`]);
    const embedCdn = new cloudfront.Distribution(this, 'Embed', {
      comment: 'miceplans Embed',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: new origins.HttpOrigin(embedOrigin, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, httpPort: EMBED_PORT, readTimeout: Duration.seconds(60), keepaliveTimeout: Duration.seconds(60) }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Authorization 헤더를 원본에 넘긴다(TEI API 키).
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });
    // worker는 배포 때 이 경로의 값을 .env로 받는다. API(Vercel)에는 같은 값을 환경 변수로 넣는다(infra/README.md).
    new ssm.StringParameter(this, 'TeiUrlParam', { parameterName: `${PARAM_PATH}/TEI_URL`, stringValue: `https://${embedCdn.distributionDomainName}` });

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
    new CfnOutput(this, 'ApiFilesUserName', { value: apiFilesUser.userName });
    new CfnOutput(this, 'ParameterPath', { value: PARAM_PATH });
    new CfnOutput(this, 'EmbedInstanceId', { value: embedInstance.instanceId });
    new CfnOutput(this, 'EmbedUrl', { value: `https://${embedCdn.distributionDomainName}` });
  }
}
