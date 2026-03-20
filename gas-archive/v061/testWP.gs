function testWpPost() {
  // 1. Check properties
  var props  = PropertiesService.getScriptProperties();
  var wpUrl  = props.getProperty('WP_URL')        || '';
  var secret = props.getProperty('WP_API_SECRET') || '';
  console.log('WP_URL:', JSON.stringify(wpUrl));
  console.log('Secret length:', secret.length);

  // 2. SSRF guard (fixed — no new URL())
  var _allowed = ['https://icarenow.io', 'https://www.icarenow.io'];
  if (_allowed.indexOf(wpUrl.toLowerCase().replace(/\/$/, '')) === -1) {
    console.log('SSRF guard FAILED — URL rejected');
    return;
  }
  console.log('SSRF guard passed');

  // 3. Hit WordPress
  try {
    var resp = UrlFetchApp.fetch(wpUrl + '/wp-json/pmc/v1/validate', {
      method:             'post',
      contentType:        'application/json',
      headers:            { 'X-PMC-Secret': secret },
      payload:            JSON.stringify({ key: '92c911362271539fdebeee88e71d280a2ff86dc5d53f133351a62076480d0409' }),
      muteHttpExceptions: true,
      followRedirects:    false
    });
    console.log('HTTP status:', resp.getResponseCode());
    console.log('Response:', resp.getContentText().substring(0, 500));
  } catch (e) {
    console.log('Fetch threw:', e.message);
  }
}

