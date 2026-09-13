import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const createdDirs: string[] = [];

export function makeTempProject(csContent: string): { dir: string; csproj: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-parser-'));
  createdDirs.push(dir);

  const csproj = path.join(dir, 'Test.csproj');

  fs.writeFileSync(
    csproj,
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>`
  );

  fs.writeFileSync(path.join(dir, 'Model.cs'), csContent);

  return { dir, csproj };
}

export function makeTempProjectWithFiles(
  files: Record<string, string>
): { dir: string; csproj: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-parser-'));
  createdDirs.push(dir);

  const csproj = path.join(dir, 'Test.csproj');

  fs.writeFileSync(
    csproj,
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>`
  );

  for (const [fileName, content] of Object.entries(files)) {
    const filePath = path.join(dir, fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  return { dir, csproj };
}

export function cleanupTempProjects(): void {
  while (createdDirs.length) {
    const dir = createdDirs.pop()!;

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort; ignore lingering handles (e.g. Windows AV/indexer)
    }
  }
}
