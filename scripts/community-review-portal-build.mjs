import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function buildCommunityReviewPortal(root = repositoryRoot) {
  const sourceDirectory = path.join(root, "services/community-review-service/portal-src");
  const outputDirectory = path.join(root, "services/community-review-service/dist/portal");
  const sdkPackageDirectory = path.join(root, "node_modules/@auth0/auth0-spa-js");
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  // 根 manifest 是唯一版本来源；范围、标签和安装版本漂移均拒绝构建。
  const sdkVersion = manifest?.devDependencies?.["@auth0/auth0-spa-js"];
  if (typeof sdkVersion !== "string" || !/^\d+\.\d+\.\d+$/u.test(sdkVersion)) {
    throw new Error("Auth0 SPA SDK must have an exact version in the root manifest.");
  }

  const sdkPackage = JSON.parse(await readFile(path.join(sdkPackageDirectory, "package.json"), "utf8"));
  if (sdkPackage?.name !== "@auth0/auth0-spa-js" ||
    sdkPackage.version !== sdkVersion || sdkPackage.license !== "MIT") {
    throw new Error("Unexpected Auth0 SPA SDK package metadata.");
  }

  const sdkSource = await readFile(
    path.join(sdkPackageDirectory, "dist/auth0-spa-js.production.js"),
    "utf8",
  );
  const sdkWithoutSourceMap = sdkSource.replace(/\r?\n\/\/# sourceMappingURL=[^\r\n]*\r?\n?$/u, "");
  if (/(?:^|\r?\n)\s*\/\/# sourceMappingURL=/u.test(sdkWithoutSourceMap)) {
    throw new Error("Unexpected Auth0 SPA SDK source map reference.");
  }
  const license = await readFile(path.join(sdkPackageDirectory, "LICENSE"), "utf8");
  if (!license.includes("MIT License") || !license.includes("Permission is hereby granted")) {
    throw new Error("Unexpected Auth0 SPA SDK license file.");
  }

  // 包和许可证检查全部成功后才替换产物，校验失败不发布部分 vendor 内容。
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(path.join(outputDirectory, "vendor"), { recursive: true });
  for (const file of ["index.html", "portal.css", "portal.js", "favicon.svg"]) {
    await cp(path.join(sourceDirectory, file), path.join(outputDirectory, file));
  }
  await writeFile(path.join(outputDirectory, "vendor/auth0-spa-js.js"), sdkWithoutSourceMap, "utf8");
  await writeFile(path.join(outputDirectory, "vendor/auth0-spa-js.LICENSE.txt"), license, "utf8");

  return { status: "built", outputDirectory, auth0SpaSdk: sdkVersion, sourceMapIncluded: false };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(JSON.stringify(await buildCommunityReviewPortal()) + "\n");
}
