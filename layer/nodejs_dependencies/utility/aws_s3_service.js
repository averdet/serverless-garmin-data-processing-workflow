var AWSXRay = require('aws-xray-sdk-core');
const AWSS3 = AWSXRay.captureAWS(require('aws-sdk'));
// Configure the context missing strategy to do nothing
AWSXRay.setContextMissingStrategy(() => {});


const paramsS3 =
  process.env.Test === "true"
    ? {
      region: process.env.AWS_REGION,
      endpoint: process.env.endpoint,
      s3ForcePathStyle: true
      }
    : {
      region: process.env.AWS_REGION,
      s3ForcePathStyle: true
      };

const s3 = new AWSS3.S3(paramsS3);

exports.getPayload = async function (key, bucketName) {
  var params = {
    Key: key,
    Bucket: bucketName,
  };
  const payload = await s3
    .getObject(params)
    .promise()
    .then((data) => {
      console.log("file downloaded successfully");
      return data.Body.toString('utf-8');
    })
    .catch((err) => {
      throw err;
    });
  return payload;
};

exports.setPayload = async function (key, bucketName, body, tag = '') {
  let fitFileLocation = "";
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    Tagging: tag
  };
  data = await s3.upload(params).promise();
  if (data.Location) {
    console.log(`File uploaded successfully. ${data.Location}`);
    fitFileLocation = data.Location;
  }
  return fitFileLocation;
};
