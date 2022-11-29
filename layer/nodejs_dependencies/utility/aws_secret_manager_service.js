const AWSSecretSDK = require("aws-sdk");
var AWSXRay = require("aws-xray-sdk-core");
// Configure the context missing strategy to do nothing
AWSXRay.setContextMissingStrategy(() => {});

const paramsSecretManager =
  process.env.Test === "true"
    ? {
        region: process.env.AWS_REGION,
        endpoint: process.env.endpoint,
      }
    : {
        region: process.env.AWS_REGION,
      };

var clientSecret = AWSXRay.captureAWSClient(
  new AWSSecretSDK.SecretsManager(paramsSecretManager)
);

exports.retrieveSecret = async function (secretName) {
  // const secret = "";
  // await clientSecret
  //   .getSecretValue({ SecretId: secretName }, function (err, data) {
  //     if (err) {
  //       if (err.code === "DecryptionFailureException") throw err;
  //       else if (err.code === "InternalServiceErrorException") throw err;
  //       else if (err.code === "InvalidParameterException") throw err;
  //       else if (err.code === "InvalidRequestException") throw err;
  //       else if (err.code === "ResourceNotFoundException") throw err;
  //     } else {
  //       if ("SecretString" in data) {
  //         secret = data.SecretString;
  //       } else {
  //         let buff = new Buffer(data.SecretBinary, "base64");
  //         secret = buff.toString("ascii");
  //       }
  //     }
  //   })
  //   .promise();
  // return secret;
  const secret = clientSecret
    .getSecretValue({ SecretId: secretName })
    .promise();
  return secret;
};
