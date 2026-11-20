import { App } from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';

const app = new App();
const ctx = (key: string) => {
  const value = app.node.tryGetContext(key);
  if (!value) throw new Error(`컨텍스트 ${key}가 필요하다: cdk synth -c ${key}=...`);
  return String(value);
};

new BackendStack(app, 'MiceplansBackend', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-northeast-2' },
  githubRepo: 'miceplans/miceplaner',
  githubOidcProviderArn: ctx('githubOidcProviderArn'),
  cloudFrontPrefixListId: ctx('cloudFrontPrefixListId'),
  uploadBucketName: app.node.tryGetContext('uploadBucketName') || undefined,
});
