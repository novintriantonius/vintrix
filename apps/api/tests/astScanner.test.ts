import { describe, expect, it } from 'bun:test';
import { scanSourceFile, findCodeFiles } from '../src/services/astScanner';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Multi-Language AST Scanner', () => {
  const tmpDir = path.join(os.tmpdir(), `vintrix-ast-test-${Date.now()}`);

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  it('scans TypeScript files correctly', () => {
    const tsFile = path.join(tmpDir, 'authService.ts');
    fs.writeFileSync(
      tsFile,
      `import { db } from './db';
export class AuthService {
  async login(user: string) { return true; }
  async logout() { return false; }
}
export const hashToken = (t: string) => t;
`
    );

    const result = scanSourceFile(tsFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.node.label).toBe('AuthService');
    expect(result?.node.kind).toBe('security');
    expect(result?.node.importedModules).toContain('./db');
    expect(result?.node.exportedSymbols).toContain('AuthService');
    expect(result?.node.exportedSymbols).toContain('hashToken');
  });

  it('scans Python files correctly', () => {
    const pyFile = path.join(tmpDir, 'user_model.py');
    fs.writeFileSync(
      pyFile,
      `import sqlalchemy
from database import Base

class UserModel(Base):
    pass

def get_user_by_id(user_id: int):
    return None

def _internal_helper():
    pass
`
    );

    const result = scanSourceFile(pyFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.node.kind).toBe('database');
    expect(result?.node.importedModules).toContain('sqlalchemy');
    expect(result?.node.importedModules).toContain('database');
    expect(result?.node.exportedSymbols).toContain('UserModel');
    expect(result?.node.exportedSymbols).toContain('get_user_by_id');
    expect(result?.node.exportedSymbols).not.toContain('_internal_helper');
  });

  it('scans Go files correctly', () => {
    const goFile = path.join(tmpDir, 'gateway.go');
    fs.writeFileSync(
      goFile,
      `package gateway

import (
    "net/http"
    "fmt"
)

type ApiGateway struct {
    port int
}

func HandleRequest(w http.ResponseWriter, r *http.Request) {
    fmt.Println("request")
}
`
    );

    const result = scanSourceFile(goFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.node.kind).toBe('gateway');
    expect(result?.node.importedModules).toContain('net/http');
    expect(result?.node.exportedSymbols).toContain('ApiGateway');
    expect(result?.node.exportedSymbols).toContain('HandleRequest');
  });

  it('scans Rust files correctly', () => {
    const rsFile = path.join(tmpDir, 'worker.rs');
    fs.writeFileSync(
      rsFile,
      `use std::sync::Arc;
use tokio::task;

pub struct JobWorker {
    pub id: u32,
}

pub fn execute_job(id: u32) -> bool {
    true
}
`
    );

    const result = scanSourceFile(rsFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.node.kind).toBe('service');
    expect(result?.node.importedModules).toContain('std::sync::Arc');
    expect(result?.node.exportedSymbols).toContain('JobWorker');
    expect(result?.node.exportedSymbols).toContain('execute_job');
  });

  it('scans PHP files correctly', () => {
    const phpFile = path.join(tmpDir, 'UserController.php');
    fs.writeFileSync(
      phpFile,
      `<?php
namespace App\\Http\\Controllers;
use App\\Services\\UserService;

class UserController {
    public function index() {
        return [];
    }
}
`
    );

    const result = scanSourceFile(phpFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.node.kind).toBe('controller');
    expect(result?.node.importedModules).toContain('App\\Services\\UserService');
    expect(result?.node.exportedSymbols).toContain('UserController');
    expect(result?.node.exportedSymbols).toContain('index');
  });

  it('infers architectural domain and module categories properly', async () => {
    const { inferDomainOrModule } = await import('../src/services/astScanner');
    const authRes = inferDomainOrModule('app/Http/Controllers/Api/Auth/LoginController.ts');
    expect(authRes.kind).toBe('security');

    const modelRes = inferDomainOrModule('src/models/user.ts');
    expect(modelRes.kind).toBe('database');

    const gatewayRes = inferDomainOrModule('src/gateway/client.ts');
    expect(gatewayRes.kind).toBe('gateway');

    const configRes = inferDomainOrModule('config/app.json');
    expect(configRes.nodeType).toBe('config');
  });

  it('runs scanCodebaseDirectory and produces nodes and dependencies', async () => {
    const { scanCodebaseDirectory } = await import('../src/services/astScanner');
    const mockProjectDir = path.join(tmpDir, 'mock-project');
    const authDir = path.join(mockProjectDir, 'src', 'auth');
    fs.mkdirSync(authDir, { recursive: true });

    fs.writeFileSync(
      path.join(authDir, 'authService.ts'),
      `export class AuthService {
  validateUser() { return true; }
}`
    );

    let progressCalls = 0;
    const result = await scanCodebaseDirectory(mockProjectDir, (cur, total, p) => {
      progressCalls++;
    });

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.nodes[0].label).toBeDefined();
    expect(progressCalls).toBeGreaterThan(0);
  });

  it('filters out confidential credentials and hidden ignored files in findCodeFiles', () => {
    const scanDir = path.join(tmpDir, 'scan-filter-test');
    fs.mkdirSync(scanDir, { recursive: true });

    fs.writeFileSync(path.join(scanDir, 'index.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(scanDir, '.env'), 'SECRET=123');
    fs.writeFileSync(path.join(scanDir, 'id_rsa'), 'PRIVATE KEY');
    fs.writeFileSync(path.join(scanDir, 'credentials.json'), '{"key":"secret"}');
    fs.writeFileSync(path.join(scanDir, '.env.example'), 'APP_PORT=3000');

    const files = findCodeFiles(scanDir);
    expect(files.some((f) => f.endsWith('index.ts'))).toBeTrue();
    expect(files.some((f) => f.endsWith('.env.example'))).toBeTrue();
    expect(files.some((f) => f.endsWith('.env'))).toBeFalse();
    expect(files.some((f) => f.endsWith('id_rsa'))).toBeFalse();
    expect(files.some((f) => f.endsWith('credentials.json'))).toBeFalse();
  });
});
