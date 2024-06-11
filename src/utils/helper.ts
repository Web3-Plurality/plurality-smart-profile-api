export function parseQueryString(query: string) {
  let params: any = {};
  // Remove the leading question mark if present
  query = query.replace(/^\?/, '');
  // Split the query string on '&'
  const pairs = query.split('&');
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    params[key] = decodeURIComponent(value || '');
  });
  return params;
}

export function createPrompt(prompt: any, content: any) {
  if (typeof content === 'object') {
    const concatenatedCaptions = content.map(item => item.caption).join(' ');
    prompt[1].content += '\n' + concatenatedCaptions;
    return prompt;
  }
  else {
    prompt[1].content += '\n' + content;
    return prompt;
  }
}