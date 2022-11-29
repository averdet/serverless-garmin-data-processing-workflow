function inputGateway(event, context) {
  console.info("Starting Function: ", context.functionName);
  const body = JSON.parse(JSON.stringify(event.result));
  // const body = JSON.parse(event.body);
  // const body = event.body;
  return body;
}

function outputGateway(responseBody, callback) {
  console.info("Sending Data");
  const response = {
    isBase64Encoded: false,
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: responseBody,
  };
  callback(null, response);
}

module.exports = { inputGateway, outputGateway };
