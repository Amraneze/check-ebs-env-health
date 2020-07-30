#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@actions/core");
var aws_sdk_1 = __importDefault(require("aws-sdk"));
var elasticbeanstalk_1 = __importDefault(require("aws-sdk/clients/elasticbeanstalk"));
function initLogs() {
    console.info = function (msg, data) { return console.log("::info::" + msg, data); };
    console.error = function (msg, data) { return console.log("::error::" + msg, data); };
    console.warn = function (msg, data) { return console.log("::warning::" + msg, data); };
    console.log("Check-ebs-env-health: GitHub Action for checking AWS Elastic Beanstalk environment's health.");
}
function parseArgs() {
    var region = process.env.INPUT_REGION.trim();
    var accessKeyId = process.env.INPUT_AWS_ACCESS_KEY.trim();
    var secretAccessKey = process.env.INPUT_AWS_SECRET_KEY.trim();
    var environmentName = process.env.INPUT_ENVIRONMENT_NAME.trim();
    var waitForEnvToBeHealthy = parseInt(process.env.INPUT_WAIT_FOR_ENV || '15', 10);
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
        region: region,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        environmentName: environmentName,
        waitForEnvToBeHealthy: waitForEnvToBeHealthy,
    };
}
function connectToAWS(_a) {
    var region = _a.region, onSuccess = _a.onSuccess, accessKeyId = _a.accessKeyId, secretAccessKey = _a.secretAccessKey;
    var config = new aws_sdk_1.default.Config({
        region: region,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    });
    aws_sdk_1.default.config.update({ region: region, accessKeyId: accessKeyId, secretAccessKey: secretAccessKey });
    config.getCredentials(function (error) {
        if (error) {
            console.error('Checking failed: Error while authenticating in AWS.', { stack: error.stack });
            process.exit(1);
        }
        onSuccess();
    });
}
function checkEBSEnv(_a) {
    var environmentName = _a.environmentName;
    var ebsParams = {
        EnvironmentNames: [environmentName],
    };
    var elasticbeanstalk = new elasticbeanstalk_1.default();
    elasticbeanstalk.waitFor('environmentUpdated', ebsParams, function (error, data) {
        var _a;
        if (error) {
            console.error("Checking failed: Error while getting AWS EBS environment's health.", __assign(__assign({}, error), { stack: error.stack }));
            process.exit(1);
        }
        (_a = data.Environments) === null || _a === void 0 ? void 0 : _a.forEach(function (env) {
            if (env.Health === 'Red' ||
                ['Degraded', 'Severe', 'Suspended'].includes(env.HealthStatus || '')) {
                console.error("Checking failed: AWS EBS environment's health is not responsive.", __assign({}, env));
                process.exit(1);
            }
            core_1.setOutput('ebs_env', env);
        });
        process.exit(0);
    });
}
function init() {
    initLogs();
    // waitForEnvToBeHealthy is not used yet
    var _a = parseArgs(), region = _a.region, accessKeyId = _a.accessKeyId, secretAccessKey = _a.secretAccessKey, environmentName = _a.environmentName, waitForEnvToBeHealthy = _a.waitForEnvToBeHealthy;
    console.group('Checking the AWS EBS environment with arguments:');
    console.log("          Environment's name: ", environmentName);
    console.log('                  AWS Region: ', region);
    console.log('            Waiting duration: ', waitForEnvToBeHealthy);
    console.groupEnd();
    connectToAWS({
        region: region,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        onSuccess: function () { return checkEBSEnv({ environmentName: environmentName }); },
    });
}
init();
