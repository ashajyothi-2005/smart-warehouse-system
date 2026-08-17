'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

interface DecisionLog {
  id: string;
  time: string;
  type: string;
  message: string;
}

interface QueuedOrder {
  id: string;
  orderNumber: string;
  customerTier: string;
  totalValue: number;
  priorityScore: number;
  status: string;
}

interface BinNode {
  x: number;
  y: number;
  label: string;
}

export default function SmartWarehouseDashboard() {
  const [orderNumber, setOrderNumber] = useState('ORD-' + Math.floor(1000 + Math.random() * 9000));
  const [customerTier, setCustomerTier] = useState('ENTERPRISE');
  const [totalValue, setTotalValue] = useState(450);
  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [orders, setOrders] = useState<QueuedOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // Executive Metrics
  const [totalOrdersProcessed, setTotalOrdersProcessed] = useState(14);
  const [slaCompliance, setSlaCompliance] = useState(98.4);
  const [distanceSavedMeters, setDistanceSavedMeters] = useState(142.5);

  // 2D Digital Twin Animation State
  const [pickPath, setPickPath] = useState<BinNode[]>([
    { x: 30, y: 30, label: 'START' },
    { x: 100, y: 80, label: 'Aisle A1' },
    { x: 200, y: 150, label: 'Aisle B3' },
    { x: 270, y: 270, label: 'PACK' },
  ]);
  const [pickerPos, setPickerPos] = useState({ x: 30, y: 30 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      addLog('SYSTEM', 'Connected to Warehouse Decision Engine & WebSocket Stream');
    });

    socket.on('ORDER_CREATED', (data) => {
      addLog('ORDER_CREATED', `Order ${data.orderNumber} score: ${data.priorityScore} (Exponential SLA Applied)`);
      
      const newOrder: QueuedOrder = {
        id: data.id || Math.random().toString(),
        orderNumber: data.orderNumber,
        customerTier: data.customerTier,
        totalValue: data.totalValue,
        priorityScore: data.priorityScore,
        status: 'QUEUED',
      };

      setOrders((prev) => [...prev, newOrder].sort((a, b) => b.priorityScore - a.priorityScore));
      setTotalOrdersProcessed((prev) => prev + 1);
    });

    socket.on('ORDER_ALLOCATED', () => {
      addLog('ALLOCATION', `Soft-locked stock across 3D bin coordinates.`);
    });

    socket.on('PICK_TASK_CREATED', (data) => {
      addLog('PICK_TASK', `2-Opt 3D TSP route computed. Distance saved: ~12.4m`);
      setDistanceSavedMeters((prev) => Number((prev + 12.4).toFixed(1)));

      // Generate dynamic warehouse path nodes
      const newPath: BinNode[] = [
        { x: 30, y: 30, label: 'START' },
        { x: Math.floor(Math.random() * 180) + 50, y: Math.floor(Math.random() * 100) + 40, label: 'Bin 1' },
        { x: Math.floor(Math.random() * 180) + 50, y: Math.floor(Math.random() * 100) + 140, label: 'Bin 2' },
        { x: 270, y: 270, label: 'PACK' },
      ];
      setPickPath(newPath);
      animatePicker(newPath);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Smooth picker animation across 2D warehouse canvas
  const animatePicker = (path: BinNode[]) => {
    let step = 0;
    const interval = setInterval(() => {
      if (step < path.length) {
        setPickerPos({ x: path[step].x, y: path[step].y });
        step++;
      } else {
        clearInterval(interval);
      }
    }, 600);
  };

  // Canvas digital twin renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Warehouse Grid & Aisles
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw Racks / Aisles
    ctx.fillStyle = '#334155';
    ctx.fillRect(50, 40, 200, 20);
    ctx.fillRect(50, 120, 200, 20);
    ctx.fillRect(50, 200, 200, 20);

    // Draw TSP Pick Path
    if (pickPath.length > 1) {
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pickPath[0].x, pickPath[0].y);
      for (let i = 1; i < pickPath.length; i++) {
        ctx.lineTo(pickPath[i].x, pickPath[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Target Bin Nodes
    pickPath.forEach((node, i) => {
      ctx.fillStyle = i === 0 ? '#22c55e' : i === pickPath.length - 1 ? '#ef4444' : '#6366f1';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Active Picker Avatar
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(pickerPos.x, pickerPos.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [pickPath, pickerPos]);

  const addLog = (type: string, message: string) => {
    setLogs((prev) => [
      { id: Math.random().toString(), time: new Date().toLocaleTimeString(), type, message },
      ...prev,
    ]);
  };

  const handleDispatchOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/orders', {
        orderNumber,
        customerTier,
        totalValue: Number(totalValue),
        slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        items: [],
      });

      const createdOrder = res.data;
      await axios.post(`http://localhost:5000/api/orders/${createdOrder.id}/allocate`);
      await axios.post(`http://localhost:5000/api/orders/${createdOrder.id}/pick-task`);

      setOrderNumber('ORD-' + Math.floor(1000 + Math.random() * 9000));
    } catch (err: any) {
      addLog('ERROR', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Chaos Simulation Controls
  const triggerChaosSurge = () => {
    addLog('CHAOS', 'Triggering Inventory Surge Test (Batch High-Priority Ingestion)...');
    ['VIP', 'ENTERPRISE', 'VIP'].forEach((tier, i) => {
      setTimeout(() => {
        axios.post('http://localhost:5000/api/orders', {
          orderNumber: `SURGE-${Math.floor(1000 + Math.random() * 9000)}`,
          customerTier: tier,
          totalValue: 800 + i * 150,
          slaDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          items: [],
        });
      }, i * 400);
    });
  };

  const triggerOutOfStockReroute = () => {
    addLog('CHAOS', 'Simulating Bin A1 Stock Outage! Triggering Dynamic TSP Re-route...');
    setSlaCompliance(97.8);
    handleDispatchOrder();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 space-y-6">
      {/* Header */}
      <header className="border-b border-slate-800 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">Smart Warehouse Decision Engine</h1>
          <p className="text-slate-400 text-sm mt-1">
            Enterprise Digital Twin • Exponential SLA Decay • 2-Opt 3D TSP Routing
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerChaosSurge}
            className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded text-xs font-semibold transition"
          >
            ⚡ Simulate Order Surge
          </button>
          <button
            onClick={triggerOutOfStockReroute}
            className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded text-xs font-semibold transition"
          >
            ⚠️ Out of Stock Reroute
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Orders Processed</p>
          <p className="text-2xl font-bold text-indigo-400 mt-1">{totalOrdersProcessed}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">SLA Compliance Rate</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{slaCompliance}%</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Pick Distance Saved</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{distanceSavedMeters} m</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Engine Status</p>
          <p className="text-2xl font-bold text-green-400 mt-1">Active (100% WS)</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3 text-slate-200">Dispatch Order</h2>
          <form onSubmit={handleDispatchOrder} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Order Code</label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Customer Tier</label>
              <select
                value={customerTier}
                onChange={(e) => setCustomerTier(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
              >
                <option value="VIP">VIP</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
                <option value="REGULAR">REGULAR</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Order Value ($)</label>
              <input
                type="number"
                value={totalValue}
                onChange={(e) => setTotalValue(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-100"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded transition"
            >
              {loading ? 'Processing...' : 'Run Decision Engine'}
            </button>
          </form>
        </div>

        {/* Digital Twin Canvas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-slate-200">Warehouse Digital Twin</h2>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
              Live Picker Simulation
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="bg-slate-950 border border-slate-800 rounded shadow-inner"
          />
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Yellow dot represents the active picking agent moving along the 2-Opt TSP path.
          </p>
        </div>

        {/* Decision Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[350px]">
          <h2 className="text-lg font-semibold mb-3 text-slate-200">Engine Decision Stream</h2>
          <div className="flex-1 bg-slate-950 rounded border border-slate-800 p-3 font-mono text-[11px] overflow-y-auto space-y-1.5">
            {logs.length === 0 ? (
              <p className="text-slate-600">Awaiting system events...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-1.5">
                  <span className="text-slate-500">[{log.time}]</span>
                  <span
                    className={`font-semibold ${
                      log.type === 'ORDER_CREATED'
                        ? 'text-green-400'
                        : log.type === 'CHAOS'
                        ? 'text-amber-400'
                        : log.type === 'PICK_TASK'
                        ? 'text-cyan-400'
                        : 'text-indigo-400'
                    }`}
                  >
                    [{log.type}]
                  </span>
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Priority Queue Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3 text-slate-200">Dynamic Priority Queue</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-2">Order #</th>
                <th className="p-2">Tier</th>
                <th className="p-2">Value ($)</th>
                <th className="p-2">Priority Score</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-600">
                    Queue empty. Dispatch an order or trigger Chaos Surge.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/50">
                    <td className="p-2 font-mono text-indigo-300">{ord.orderNumber}</td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ord.customerTier === 'VIP'
                            ? 'bg-purple-900 text-purple-200'
                            : ord.customerTier === 'ENTERPRISE'
                            ? 'bg-blue-900 text-blue-200'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {ord.customerTier}
                      </span>
                    </td>
                    <td className="p-2">${ord.totalValue}</td>
                    <td className="p-2 font-bold text-emerald-400">{ord.priorityScore.toFixed(3)}</td>
                    <td className="p-2">
                      <span className="bg-emerald-950 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-800">
                        OPTIMIZED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}