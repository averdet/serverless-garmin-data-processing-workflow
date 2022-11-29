const AWS = require("aws-sdk");
const FitParser = require("fit-file-parser/dist/fit-parser.js").default;
var fitParser = new FitParser({
  force: true,
  speedUnit: "km/h",
  lengthUnit: "km",
  temperatureUnit: "kelvin",
  elapsedRecordField: true,
  mode: "cascade",
});

exports.parseFitFile = function (arrayBufferData) {
  let fitFileDecoded = "";
  fitParser.parse(arrayBufferData, function (error, data) {
    if (error) {
      console.log(error);
    } else {
      fitFileDecoded = data;
    }
  });
  return fitFileDecoded;
};
