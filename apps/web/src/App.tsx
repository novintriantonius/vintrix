import { useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Code2, Layers, Search, Server, Box } from 'lucide-react';

const initialNodes: Node[] = [
  {
    id: 'api-1',
    data: { label: 'AuthController (API)' },
    position: { x: 50, y: 100 },
    style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #89b4fa', borderRadius: '8px', padding: '12px' },
  },
  {
    id: 'srv-1',
    data: { label: 'AuthService (Service)' },
    position: { x: 300, y: 100 },
    style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #a6e3a1', borderRadius: '8px', padding: '12px' },
  },
  {
    id: 'repo-1',
    data: { label: 'UserRepository (Database)' },
    position: { x: 550, y: 100 },
    style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #f9e2af', borderRadius: '8px', padding: '12px' },
  },
  {
    id: 'sec-1',
    data: { label: 'CryptoEngine (AES-256-GCM)' },
    position: { x: 300, y: 250 },
    style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #f38ba8', borderRadius: '8px', padding: '12px' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'api-1', target: 'srv-1', animated: true, style: { stroke: '#89b4fa' } },
  { id: 'e2-3', source: 'srv-1', target: 'repo-1', animated: true, style: { stroke: '#a6e3a1' } },
  { id: 'e2-4', source: 'srv-1', target: 'sec-1', animated: true, style: { stroke: '#f38ba8' } },
];

export default function App() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(initialNodes[0]);
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');

  const onNodesChange: OnNodesChange = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange: OnEdgesChange = (changes) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0a0a0c', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '48px', background: '#111116', borderBottom: '1px solid #22222b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '16px', color: '#d4a574' }}>
          <Box size={20} />
          <span>Vintrix</span>
          <span style={{ fontSize: '11px', color: '#888', background: '#222', padding: '2px 6px', borderRadius: '4px' }}>workspace: default</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#aaa' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Server size={14} /> Engine: XERJ (Ready)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={14} /> Nodes: {nodes.length}</span>
        </div>
      </div>

      {/* Main Graph Canvas (75%) */}
      <div style={{ flex: 1, height: 'calc(100vh - 48px)', marginTop: '48px', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNode(node)}
          fitView
        >
          <Background color="#222" gap={16} />
          <Controls />
        </ReactFlow>

        {/* Bottom Sliding Code Snippet Panel */}
        {selectedNode && (
          <div style={{ position: 'absolute', bottom: 12, left: 16, right: 380, background: '#111116ee', backdropFilter: 'blur(8px)', border: '1px solid #282834', borderRadius: '8px', padding: '12px', zIndex: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#d4a574' }}>
                <Code2 size={14} /> Selected Element: {String(selectedNode.data?.label || selectedNode.id)}
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>lines: 24-89 • file:line precision</span>
            </div>
            <pre style={{ margin: 0, padding: '8px', background: '#0a0a0d', borderRadius: '4px', fontSize: '11px', color: '#a6e3a1', overflowX: 'auto' }}>
{`// AST Parsed definition via XERJ
export class ${String(selectedNode.data?.label || '').split(' ')[0]} {
  // ISO-27001 Cryptographic validation & service linkage
  async execute() { return true; }
}`}
            </pre>
          </div>
        )}
      </div>

      {/* Right Sidebar (360px) */}
      <div style={{ width: '360px', height: 'calc(100vh - 48px)', marginTop: '48px', background: '#111116', borderLeft: '1px solid #22222b', display: 'flex', flexDirection: 'column' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #22222b' }}>
          <button
            onClick={() => setActiveTab('info')}
            style={{ flex: 1, padding: '10px', background: activeTab === 'info' ? '#181820' : 'transparent', color: activeTab === 'info' ? '#d4a574' : '#888', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
          >
            Node Info
          </button>
          <button
            onClick={() => setActiveTab('files')}
            style={{ flex: 1, padding: '10px', background: activeTab === 'files' ? '#181820' : 'transparent', color: activeTab === 'files' ? '#d4a574' : '#888', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
          >
            File Explorer
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'info' ? (
            <div>
              <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#fff' }}>Component Overview</h3>
              {selectedNode ? (
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div><strong style={{ color: '#888' }}>Identifier:</strong> {selectedNode.id}</div>
                  <div><strong style={{ color: '#888' }}>Label:</strong> {String(selectedNode.data?.label)}</div>
                  <div><strong style={{ color: '#888' }}>Architecture Layer:</strong> {selectedNode.id.startsWith('api') ? 'API' : selectedNode.id.startsWith('srv') ? 'Service' : 'Data'}</div>
                  <div style={{ marginTop: '12px', padding: '10px', background: '#181820', borderRadius: '6px', border: '1px solid #282834' }}>
                    <div style={{ color: '#d4a574', marginBottom: '4px', fontWeight: 500 }}>Plain-English Summary</div>
                    <div style={{ color: '#aaa', lineHeight: 1.4 }}>Komponen ini bertanggung jawab atas alur logic proses request dan berelasi langsung dengan service layer codebase.</div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: '12px' }}>Pilih salah satu node pada graph untuk melihat detail.</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '6px 8px', background: '#181820', borderRadius: '4px' }}>
                <Search size={14} color="#888" />
                <input placeholder="Filter files..." style={{ background: 'transparent', border: 'none', color: '#eee', outline: 'none', width: '100%', fontSize: '12px' }} />
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', color: '#aaa' }}>
                <li style={{ cursor: 'pointer' }}>📁 src/auth/</li>
                <li style={{ paddingLeft: '16px', color: '#89b4fa' }}>📄 controller.ts</li>
                <li style={{ paddingLeft: '16px', color: '#a6e3a1' }}>📄 service.ts</li>
                <li style={{ cursor: 'pointer' }}>📁 src/user/</li>
                <li style={{ paddingLeft: '16px', color: '#f9e2af' }}>📄 repository.ts</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
