export async function getRouteParam<K extends string>(
  props: unknown,
  key: K,
): Promise<string> {
  const { [key]: value } = await (props as { params: Promise<Record<K, string>> }).params;
  return value;
}
