
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



export function extractContent(data:any) {
    let content = '';
    for (let index = 0; index < data.length; index++) {
      if (data[index]?.message && data[index]?.description) {
        content += data[index]?.message 
        content += "\n"
        content += data[index]?.description;
        content += "\n"
      }
      else if (data[index]?.message) {
        content += data[index]?.message;
        content += "\n"
      }
      else if (data[index]?.description) {
        content += data[index]?.description;
        content += "\n"
      }
      else if (data[index]?.name) {
        content += data[index]?.name;
        content += "\n"
      }
      
    }
  return content;

}



export function removeIdsFromObjects(data:any) {
  return data
      .map(obj => {
          const { id, ...rest } = obj;
          return rest;
      })
      .filter(obj => obj.description || obj.message || obj.name || obj.about || obj.category);
}
