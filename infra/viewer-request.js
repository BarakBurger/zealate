// CloudFront viewer-request function for the site (not /api). Two jobs:
// 1. www.zealate.com -> zealate.com, so every page has one address.
// 2. App routes (/desk, /b/x/read/y) have no file in S3: serve the app shell for them. Paths with a
//    file extension (assets, favicon) are served as they are, and a missing one is a real 404.
function handler(event) {
  var req = event.request;
  var host = req.headers.host && req.headers.host.value;
  if (host && host.indexOf('www.') === 0) {
    var qs = Object.keys(req.querystring).map(function (k) { return k + '=' + req.querystring[k].value; }).join('&');
    return { statusCode: 301, statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://' + host.slice(4) + req.uri + (qs ? '?' + qs : '') } } };
  }
  var last = req.uri.split('/').pop();
  if (last.indexOf('.') === -1) req.uri = '/index.html';
  return req;
}
