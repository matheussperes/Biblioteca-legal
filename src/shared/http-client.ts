/**
 * Lê a resposta de um fetch como JSON com segurança.
 *
 * Erros de plataforma (limite de tamanho do corpo excedido, timeout de função,
 * página de erro do Vercel etc.) chegam como texto/HTML, não JSON — chamar
 * `res.json()` direto nesses casos falha com "Unexpected token ... is not
 * valid JSON", uma mensagem incompreensível para o usuário. Esta função lê o
 * corpo como texto primeiro e traduz falhas de parsing em um erro legível.
 */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text) {
    if (!res.ok) throw new Error(`Erro ${res.status} ao processar a requisição.`);
    return undefined as T;
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? "O servidor retornou uma resposta inesperada."
        : `Erro ${res.status}: ${text.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Erro ${res.status} ao processar a requisição.`;
    throw new Error(message);
  }

  return data as T;
}
