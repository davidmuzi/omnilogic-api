import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export async function sendRequest(payload: { Request: any }): Promise<any> {
  const xmlOptions = { ignoreAttributes: false };
  const builder = new XMLBuilder(xmlOptions);

  const body = builder.build(payload);
  const options = { method: 'POST', body };
  const request = new Request(
    'https://www.haywardomnilogic.com/MobileInterface/MobileInterface.ashx',
    options
  );

  try {
    const response = await fetch(request);
    const xml = await response.text();
    const parser = new XMLParser(xmlOptions);
    return parser.parse(xml);
  } catch (error: unknown) {
    console.error('error: ', error);

    if (typeof error === 'string') {
      throw new Error(error);
    } else if (error instanceof Error) {
      throw error;
    }
    throw new Error('unknown error');
  }
}
