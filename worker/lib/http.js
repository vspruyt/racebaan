export function json(data, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  })
}

export function errorJson(status, code, message, extras = {}) {
  return json(
    {
      ok: false,
      error: {
        code,
        message,
        ...extras,
      },
    },
    { status },
  )
}
