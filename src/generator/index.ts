import * as fs from 'fs';
import * as path from 'path';
import { CSharpClass, CSharpProperty, NamingConvention } from '../types/index.js';
import type { ParseResult, TypeSharpConfig } from '../types/index.js';
import { generateEnum } from './generate-enum.js';
import { logger } from '../helpers/logger.js';

/**
 * Generate TypeScript files from parsed C# classes
 */
export function generateTypeScriptFiles(
  config: TypeSharpConfig,
  parseResults: ParseResult[],
  changedFiles?: Set<string>
): { created: number; updated: number; total: number } {
  const outputPath = config.outputPath;

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  if (config.singleOutputFile) {
    const allClasses = parseResults.flatMap(r => r.classes);
    return generateSingleFile(allClasses, outputPath);
  } else {
    return generateMultipleFiles(outputPath, config, parseResults, changedFiles)
  }
}










/**
 * Generate a single file with all types
 */
function generateSingleFile(
  classes: CSharpClass[],
  outputPath: string,
): { created: number; updated: number; total: number } {
  const content = classes
    .sort((a, b) => (a.isEnum ? -1 : 1) - (b.isEnum ? -1 : 1) || a.name.localeCompare(b.name)) // Sort by type or name - Asc order
    .map(cls => generateTypeScriptClass(cls))
    .join('\n\n');

  const header = generateFileHeader();
  const fullContent = `${header}\n\n${content}\n`;

  const fileName = 'types.ts';
  const filePath = path.join(outputPath, fileName);

  const isNewFile = !fs.existsSync(filePath);
  fs.writeFileSync(filePath, fullContent, 'utf-8');

  logger[isNewFile ? 'info' : 'success']('generateSingleFile', `${isNewFile ? 'Created' : 'Updated'}: ${filePath}`);

  return {
    created: isNewFile ? 1 : 0,
    updated: !isNewFile ? 1 : 0,
    total: 1
  };
}







/**
 * Generate multiple files - with incremental writing
 * This preserves the original grouping of classes
 */
function generateMultipleFiles(
  outputPath: string,
  config: TypeSharpConfig,
  parseResults: ParseResult[],
  changedFiles?: Set<string>
): { created: number; updated: number; total: number } {
  const dirConvention = typeof config.namingConvention === 'string' ? config.namingConvention : config.namingConvention?.dir ?? 'snake';
  const fileConvention = typeof config.namingConvention === 'string' ? config.namingConvention : config.namingConvention?.file ?? 'camel';

  const classToFileMap = buildClassToFileMap(parseResults, config, outputPath, fileConvention);
  const parseResultsSorted = parseResults.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  let createdCount = 0;
  let updatedCount = 0;

  for (const result of parseResultsSorted) {
    // Skip if this C# file hasn't changed
    if (changedFiles && !changedFiles.has(result.filePath)) {
      continue
    }
    const content = result.classes.map(cls => generateTypeScriptClass(cls)).join('\n\n');

    const relativeDir = path.dirname(result.relativePath);
    let appDir = path.join(outputPath, relativeDir);
    // Only convert naming convention for the relative path part, not the base outputPath
    if (relativeDir !== '.') {
      appDir = path.join(outputPath, convertDirName(relativeDir, dirConvention));
    }

    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }

    const originalFileName = path.basename(result.relativePath, '.cs');
    let baseName = originalFileName;
    if (config.fileSuffix) {
      const suffix = config.fileSuffix.charAt(0).toUpperCase() + config.fileSuffix.slice(1);
      baseName = `${baseName}${suffix}`;
    }

    const fileName = convertFileName(baseName, fileConvention);
    const filePath = path.join(appDir, `${fileName}.ts`);

    const currentClassNames = result.classes.map(c => c.name);
    const imports = generateImports(result.classes, classToFileMap, filePath, currentClassNames, dirConvention);
    const header = generateFileHeader();
    const fullContent = imports
      ? `${imports}\n\n${header}\n\n${content}\n`
      : `${header}\n\n${content}\n`;

    const isNewFile = !fs.existsSync(filePath);
    if (isNewFile || shouldWriteFile(filePath, fullContent)) {
      fs.writeFileSync(filePath, fullContent, 'utf-8');
      if (isNewFile) createdCount++;
      else updatedCount++;
    }
  }

  return {
    created: createdCount,
    updated: updatedCount,
    total: createdCount + updatedCount
  };
}


/**
 * Check if file content changed before writing
 */
function shouldWriteFile(filePath: string, newContent: string): boolean {
  if (!fs.existsSync(filePath)) {
    return true; // New file, write it
  }

  const existingContent = fs.readFileSync(filePath, 'utf-8');
  return existingContent !== newContent; // Write only if different
}



/**
 * Build a map of class names to their output file paths
 */
function buildClassToFileMap(
  parseResults: ParseResult[],
  config: TypeSharpConfig,
  outputPath: string,
  namingConvension: NamingConvention
): Map<string, string> {
  const map = new Map<string, string>();
  for (const result of parseResults) {
    const relativeDir = path.dirname(result.relativePath);
    let targetDir = path.join(outputPath, relativeDir);
    // Only convert naming convention for the relative path part, not the base outputPath
    if (relativeDir !== '.') {
      targetDir = path.join(outputPath, convertDirName(relativeDir, namingConvension));
    }

    const originalFileName = path.basename(result.relativePath, '.cs');

    let baseName = originalFileName;
    if (config.fileSuffix) {
      const suffix = convertFileName(config.fileSuffix, namingConvension);
      baseName = `${baseName}-${suffix}`;
    }

    const fileName = convertFileName(baseName, namingConvension);
    const filePath = path.join(targetDir, `${fileName}.ts`);

    // Map all classes in this file to this file path
    for (const cls of result.classes) {
      map.set(cls.name, filePath);
    }
  }

  return map;
}




/**
 * Generate import statements for referenced types
 */
function generateImports(
  classes: CSharpClass[],
  classToFileMap: Map<string, string>,
  currentFilePath: string,
  currentClassNames: string[],
  namingConvension: NamingConvention
): string {
  const imports = new Map<string, Set<string>>(); // filePath -> Set of class names

  for (const cls of classes) {
    // Skip enums as they don't have properties
    if (cls.isEnum) continue;

    // Check inheritance
    if (cls.inheritsFrom && !currentClassNames.includes(cls.inheritsFrom)) {
      const referencedFilePath = classToFileMap.get(cls.inheritsFrom);
      if (referencedFilePath && referencedFilePath !== currentFilePath) {
        if (!imports.has(referencedFilePath)) {
          imports.set(referencedFilePath, new Set());
        }
        imports.get(referencedFilePath)!.add(cls.inheritsFrom);
      }
    }

    // Check property types
    for (const prop of cls.properties) {
      // Extract base type (remove array brackets and nullable)
      const referencedType = prop.type;

      // Skip primitive types
      if (isPrimitiveType(referencedType)) continue;

      // Skip if it's in the same file
      if (currentClassNames.includes(referencedType)) continue;

      const referencedFilePath = classToFileMap.get(referencedType);
      if (referencedFilePath && referencedFilePath !== currentFilePath) {
        if (!imports.has(referencedFilePath)) {
          imports.set(referencedFilePath, new Set());
        }
        imports.get(referencedFilePath)!.add(referencedType);
      }
    }
  }

  // Generate import statements
  const importStatements: string[] = [];
  for (const [filePath, classNames] of imports.entries()) {
    const relativePath = getRelativeImportPath(currentFilePath, filePath, namingConvension);
    const sortedNames = Array.from(classNames).sort();
    importStatements.push(`import type { ${sortedNames.join(', ')} } from '${relativePath}';`);
  }

  return importStatements.length > 0 ? importStatements.join('\n') : '';
}





/**
 * Get relative import path from one file to another
 */
function getRelativeImportPath(fromFile: string, toFile: string, namingConvension: NamingConvention): string {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);
  // Remove .ts extension
  relativePath = relativePath.replace(/\.ts$/, '');

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  // Convert dir naming
  relativePath = convertDirName(relativePath, namingConvension);

  // Convert Windows backslashes to forward slashes
  relativePath = relativePath.replace(/\\/g, '/');

  return relativePath;
}





/**
 * Check if a type is a primitive TypeScript type
 */
function isPrimitiveType(type: string): boolean {
  const primitives = ['string', 'number', 'boolean', 'any', 'void', 'null', 'undefined'];
  return primitives.includes(type);
}





/**
 * Generate TypeScript interface or enum from C# class
 */
function generateTypeScriptClass(cls: CSharpClass): string {
  if (cls.isEnum) {
    return generateEnum(cls);
  }

  return generateInterface(cls);
}






/**
 * Generate TypeScript interface
 */

function generateInterface(cls: CSharpClass): string {
  // Build generic parameters for the interface
  const genericParams = cls.genericParameters?.length
    ? `<${cls.genericParameters.join(', ')}>`
    : '';

  // Build extends clause with generics
  let extendsClause = '';
  if (cls.inheritsFrom) {
    const baseGenerics = cls.baseClassGenerics?.length
      ? `<${cls.baseClassGenerics.join(', ')}>`
      : '';
    extendsClause = ` extends ${cls.inheritsFrom}${baseGenerics}`;
  }

  const body = generateInterfaceBody(cls.properties);
  return `export interface ${cls.name}${genericParams}${extendsClause} {\n${body}\n}`;
}


function generateInterfaceBody(properties: CSharpProperty[]): string {
  const lines: string[] = [];
  let currentRegion: string | undefined;

  for (const prop of properties) {
    const region = prop.region;

    // Region opened
    if (region !== currentRegion) {
      // Close previous region
      if (currentRegion !== undefined) {
        lines.push('  // #endregion');
        lines.push('');
      }
      // Open new region
      if (region !== undefined) {
        if (currentRegion === undefined) lines.push('');
        lines.push(`  // #region ${region}`);
      }
      currentRegion = region;
    }

    lines.push(generateProperty(prop));
  }

  // Close last region
  if (currentRegion !== undefined) {
    lines.push('  // #endregion');
  }

  return lines.join('\n');
}

/**
 * Generate a single property
 */
function generateProperty(prop: CSharpProperty): string {
  const propertyName = convertPropertyName(prop.name);
  let type = prop.type;

  const alreadyArrayLike = /\[\]$/.test(type);
  const isRecordType = /^Record<.*>$/.test(type);

  if (prop.isArray && !isRecordType && !alreadyArrayLike) {
    type = `${type}[]`;
  }

  if (prop.isNullable) {
    type = `${type} | null`;
  }

  // Add @deprecated JSDoc if marked obsolete
  if (prop.isDeprecated) {
    const msg = prop.deprecationMessage ? ` ${prop.deprecationMessage}` : '';
    return `  /** @deprecated${msg} */\n  ${propertyName}: ${type};`;
  }

  return `  ${propertyName}: ${type};`;
}





/**
 * Convert property name to specified convention
 */
function convertPropertyName(name: string): string {
  return toCamelCase(name);
  // switch (convention) {
  //   case 'camel':
  //     return toCamelCase(name);
  //   case 'pascal':
  //     return toPascalCase(name);
  //   case 'snake':
  //     return toSnakeCase(name);
  //   default:
  //     return name;
  // }
}






/**
 * Convert file name to specified convention
 */
export function convertFileName(name: string, convention: NamingConvention): string {
  switch (convention) {
    case 'camel':
      return toCamelCase(name);
    case 'kebab':
      return toKebabCase(name);
    case 'pascal':
      return toPascalCase(name);
    case 'snake':
      return toSnakeCase(name);
    default:
      return name;
  }
}




const convertDirName = (dir: string, convension: NamingConvention) => {
  try {
    const splitter = path.sep;
    const segments = dir.split(splitter);
    const formatted = segments.map((segment) => {
      return convertFileName(segment, convension)
    });
    const joined = formatted.join(splitter);
    return joined;
  } catch (error) {
    console.error('Error converting dir name', error);
    throw error;
  }
}



/**
 * Convert string to camelCase
 */
function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}




/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[_-](.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toUpperCase());
}




/**
 * Convert string to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}





/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}




/**
 * Generate file header comment
 */
function generateFileHeader(): string {
  return `/**
 * Auto-generated by TypeSharp
 * Do not edit this file manually
 */`;
}
