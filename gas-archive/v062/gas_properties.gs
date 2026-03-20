function fixScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('WP_URL', 'https://icarenow.io');
  props.setProperty('WP_API_SECRET', '7eeb7a668eadc19d8ef45d3fed690492cd1742f5251ac3293444effccf5a66df');
  console.log('Done. WP_URL:', props.getProperty('WP_URL'));
  console.log('Secret length:', props.getProperty('WP_API_SECRET').length);
}

