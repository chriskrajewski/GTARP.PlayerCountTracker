type StreamJsonOptions = {
  status?: number;
  headers?: HeadersInit;
  maxRecords?: number;
};

const DEFAULT_STREAM_THRESHOLD = 1000;
const DEFAULT_MAX_RECORDS = 10000;

export function shouldStreamRecords(count: number, threshold = DEFAULT_STREAM_THRESHOLD) {
  return count > threshold;
}

function createStreamHeaders(headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  }
  responseHeaders.set("X-Streamed", "1");
  return responseHeaders;
}

export function streamJsonArray<T>(items: T[], options: StreamJsonOptions = {}) {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const totalRecords = Math.min(items.length, maxRecords);
  const encoder = new TextEncoder();
  const headers = createStreamHeaders(options.headers);

  if (items.length > maxRecords) {
    headers.set("X-Result-Limit", String(maxRecords));
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("["));
      for (let i = 0; i < totalRecords; i += 1) {
        if (i > 0) {
          controller.enqueue(encoder.encode(","));
        }
        controller.enqueue(encoder.encode(JSON.stringify(items[i])));
      }
      controller.enqueue(encoder.encode("]"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: options.status ?? 200,
    headers,
  });
}

export function streamJsonObjectArray<T>(
  items: T[],
  options: StreamJsonOptions & { prefix: string; suffix: string },
) {
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const totalRecords = Math.min(items.length, maxRecords);
  const encoder = new TextEncoder();
  const headers = createStreamHeaders(options.headers);

  if (items.length > maxRecords) {
    headers.set("X-Result-Limit", String(maxRecords));
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(options.prefix));
      controller.enqueue(encoder.encode("["));
      for (let i = 0; i < totalRecords; i += 1) {
        if (i > 0) {
          controller.enqueue(encoder.encode(","));
        }
        controller.enqueue(encoder.encode(JSON.stringify(items[i])));
      }
      controller.enqueue(encoder.encode("]"));
      controller.enqueue(encoder.encode(options.suffix));
      controller.close();
    },
  });

  return new Response(stream, {
    status: options.status ?? 200,
    headers,
  });
}

