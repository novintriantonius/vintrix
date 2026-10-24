import { describe, expect, it } from 'bun:test';
import { scanSourceFile } from '../src/services/astScanner';
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
    expect(result?.label).toBe('AuthService');
    expect(result?.kind).toBe('security');
    expect(result?.importedModules).toContain('./db');
    expect(result?.exportedSymbols).toContain('AuthService');
    expect(result?.exportedSymbols).toContain('hashToken');
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
    expect(result?.kind).toBe('database');
    expect(result?.importedModules).toContain('sqlalchemy');
    expect(result?.importedModules).toContain('database');
    expect(result?.exportedSymbols).toContain('UserModel');
    expect(result?.exportedSymbols).toContain('get_user_by_id');
    expect(result?.exportedSymbols).not.toContain('_internal_helper');
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

type GatewayProxy struct {
    Target string
}

func (g *GatewayProxy) HandleRequest(w http.ResponseWriter, r *http.Request) {
    fmt.Println("routing")
}

func internalCalc() int {
    return 42
}
`
    );

    const result = scanSourceFile(goFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('gateway');
    expect(result?.importedModules).toContain('net/http');
    expect(result?.importedModules).toContain('fmt');
    expect(result?.exportedSymbols).toContain('GatewayProxy');
    expect(result?.exportedSymbols).toContain('HandleRequest');
    expect(result?.exportedSymbols).not.toContain('internalCalc');
  });

  it('scans Rust files correctly', () => {
    const rsFile = path.join(tmpDir, 'service.rs');
    fs.writeFileSync(
      rsFile,
      `use std::sync::Arc;
pub use crate::config::Settings;

pub struct PaymentEngine {
    pub balance: u64,
}

pub fn process_payment(id: &str) -> bool {
    true
}

fn private_helper() {}
`
    );

    const result = scanSourceFile(rsFile, tmpDir);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('service');
    expect(result?.importedModules).toContain('std::sync::Arc');
    expect(result?.importedModules).toContain('crate::config::Settings');
    expect(result?.exportedSymbols).toContain('PaymentEngine');
    expect(result?.exportedSymbols).toContain('process_payment');
    expect(result?.exportedSymbols).not.toContain('private_helper');
  });
});
