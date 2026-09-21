import React, { useState } from 'react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'system' | 'finance' | 'warning';
}

export const NotificationsView: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      title: 'Bling ERP Conectado',
      message: 'A sincronização com a API v3 foi estabelecida com sucesso.',
      time: 'Há 10 minutos',
      read: false,
      type: 'system',
    },
    {
      id: 'n2',
      title: 'Título a Vencer Hoje',
      message: 'Você possui contas a pagar com vencimento para hoje.',
      time: 'Há 1 hora',
      read: false,
      type: 'warning',
    },
    {
      id: 'n3',
      title: 'Boletos Bancários Prontos',
      message: 'Divisão de parcelas Febraban calculada sem perda de centavos.',
      time: 'Hoje, 09:30',
      read: true,
      type: 'finance',
    },
  ]);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f8f7] dark:bg-[#10221c] p-4 md:p-8 overflow-y-auto font-['Manrope',sans-serif]">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header idêntico ao BT Business */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">notifications</span>
              Notificações
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Avisos operacionais, alertas de vencimento e novidades do sistema
            </p>
          </div>
          <button
            onClick={markAllAsRead}
            className="text-xs font-bold text-[#11d493] hover:underline"
          >
            Marcar todas como lidas
          </button>
        </div>

        {/* Lista de Notificações */}
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border shadow-sm transition-all flex items-start gap-4 ${
                n.read
                  ? 'bg-white dark:bg-[#162f27] border-gray-200 dark:border-gray-800 opacity-80'
                  : 'bg-white dark:bg-[#19362d] border-[#11d493]/30 ring-1 ring-[#11d493]/20'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">
                  {n.type === 'warning' ? 'warning' : n.type === 'finance' ? 'payments' : 'info'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {n.title}
                  </h4>
                  <span className="text-[11px] text-gray-400 font-mono">{n.time}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {n.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
