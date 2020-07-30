#!/usr/bin/env node
import { setOutput } from '@actions/core';
import AWS from 'aws-sdk';
import ElasticBeanstalk from 'aws-sdk/clients/elasticbeanstalk';

function initLogs(): void {
  console.info = (msg: string, data: any) => console.log(`::info::${msg}`, data);
  console.error = (msg: string, data: any) => console.log(`::error::${msg}`, data);
  console.warn = (msg: string, data: any) => console.log(`::warning::${msg}`, data);
  console.log(
    "Check-ebs-env-health: GitHub Action for checking AWS Elastic Beanstalk environment's health.",
  );
}

function parseArgs(): {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  environmentName: string;
  waitForEnvToBeHealthy: number;
} {
  const region: string = process.env.INPUT_REGION!.trim();
  const accessKeyId: string = process.env.INPUT_AWS_ACCESS_KEY!.trim();
  const secretAccessKey: string = process.env.INPUT_AWS_SECRET_KEY!.trim();
  const environmentName: string = process.env.INPUT_ENVIRONMENT_NAME!.trim();
  const waitForEnvToBeHealthy: number = parseInt(process.env.INPUT_WAIT_FOR_ENV || '15', 10);

  if (!region) {
    console.error('Checking failed: Region was not specified in the arguments with.');
    process.exit(1);
  }
  if (!environmentName) {
    console.error("Checking failed: Environment's name was not specified in the arguments with.");
    process.exit(1);
  }
  if (!accessKeyId) {
    console.error('Checking failed: AWS Access Key was not specified in the arguments with.');
    process.exit(1);
  }
  if (!secretAccessKey) {
    console.error('Checking failed: AWS Secret Key was not specified in the arguments with.');
    process.exit(1);
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    environmentName,
    waitForEnvToBeHealthy,
  };
}

function connectToAWS({
  region,
  onSuccess,
  accessKeyId,
  secretAccessKey,
}: {
  region: string;
  onSuccess: Function;
  accessKeyId: string;
  secretAccessKey: string;
}): void {
  const config = new AWS.Config({
    region,
    accessKeyId,
    secretAccessKey,
  });
  AWS.config.update({ region, accessKeyId, secretAccessKey });
  config.getCredentials((error) => {
    if (error) {
      console.error('Checking failed: Error while authenticating in AWS.', { stack: error.stack });
      process.exit(1);
    }
    onSuccess();
  });
}

function checkEBSEnv({ environmentName }: { environmentName: string }) {
  const ebsParams: ElasticBeanstalk.Types.DescribeEnvironmentsMessage = {
    EnvironmentNames: [environmentName],
  };

  const elasticbeanstalk: ElasticBeanstalk = new ElasticBeanstalk();
  elasticbeanstalk.waitFor(
    'environmentUpdated',
    ebsParams,
    (error, data: ElasticBeanstalk.Types.EnvironmentDescriptionsMessage) => {
      if (error) {
        console.error("Checking failed: Error while getting AWS EBS environment's health.", {
          ...error,
          stack: error.stack,
        });
        process.exit(1);
      }
      data.Environments?.forEach((env: ElasticBeanstalk.Types.EnvironmentDescription) => {
        if (
          env.Health === 'Red' ||
          ['Degraded', 'Severe', 'Suspended'].includes(env.HealthStatus || '')
        ) {
          console.error("Checking failed: AWS EBS environment's health is not responsive.", {
            ...env,
          });
          process.exit(1);
        }
        setOutput('ebs_env', env);
      });
      process.exit(0);
    },
  );
}

function init(): void {
  initLogs();
  // waitForEnvToBeHealthy is not used yet
  const {
    region,
    accessKeyId,
    secretAccessKey,
    environmentName,
    waitForEnvToBeHealthy,
  } = parseArgs();

  console.group('Checking the AWS EBS environment with arguments:');
  console.log("          Environment's name: ", environmentName);
  console.log('                  AWS Region: ', region);
  console.log('            Waiting duration: ', waitForEnvToBeHealthy);
  console.groupEnd();

  connectToAWS({
    region,
    accessKeyId,
    secretAccessKey,
    onSuccess: () => checkEBSEnv({ environmentName }),
  });
}

init();
