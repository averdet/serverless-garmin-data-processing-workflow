function underscore(camelCasedWord) {
  if (!camelCasedWord.match(/[A-Z-]|::/g)) return camelCasedWord;
  let word = camelCasedWord.toString().replace(/::/g, ".");
  word = word.replace(/([A-Z\d]+)([A-Z][a-z])/g, "$1_$2");
  word = word.replace(/([a-z\d])([A-Z])/g, "$1_$2");
  word = word.replace(/-/g, "_");
  word = word.toLowerCase();
  return word;
}

function normalizeKeys(record) {
  const updatedRecord = [];
  for (const key of Object.keys(record)) {
    updatedRecord[underscore(key)] = record[key];
  }
  return updatedRecord;
}

function addNewField(record, newFields) {
  return { ...record, ...newFields };
}

function removeField(record, fields) {
  fields.forEach((field) => {
    delete record[field];
  });
  return record;
}

function keepField(record, allowedFields) {
  const filteredObject = Object.keys(record).reduce(function (newObj, key) {
    if (allowedFields.indexOf(key) !== -1) {
      newObj[key] = record[key];
    }
    return newObj;
  }, {});
  return filteredObject;
}

function wrapBase64Data(data, id) {
  const base64data = Buffer.from(data, 'binary').toString('base64');
  return { id: id, base64: base64data, contentType: "application/octet-stream", extension: "fit"}
}

function wrapDataToSendBaseplatform(serviceName, data, isBinary) {
  return {
    serviceName: serviceName,
    data: data,
    isBinary: isBinary
  }
}

const garminDailiesAllowedParams = [
  "steps",
  "active_time_in_seconds",
  "moderate_intensity_duration_in_seconds",
  "vigorous_intensity_duration_in_seconds",
  "floors_climbed",
  "active_kilocalories",
];


const garminHeaderParams = [
  "user_id",
  "user_access_token",
  "summary_id",
  "calendar_date"
];

module.exports = {
  garminDailiesAllowedParams,
  garminHeaderParams,
  normalizeKeys,
  underscore,
  addNewField,
  removeField,
  keepField,
  wrapDataToSendBaseplatform,
  wrapBase64Data
};
