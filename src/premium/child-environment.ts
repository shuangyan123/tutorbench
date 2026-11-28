// 本地 Git 和校准检查器只需运行时路径。只有学生 HTTP 子进程需要指定厂商凭据。
export function childEnvironment(target: "local" | "deepseek", source: NodeJS.ProcessEnv = process.env) {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LOCALAPPDATA", "LANG", "LC_ALL"]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  if (target === "deepseek" && source.DEEPSEEK_API_KEY) env.DEEPSEEK_API_KEY = source.DEEPSEEK_API_KEY;
  return env;
}
