import React from 'react';
import { Dialog } from '@headlessui/react';
import { Calendar, Copy } from 'lucide-react';
import Button from './Button';
import { toast } from 'react-hot-toast';

interface CalendarInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendarUrl: string;
}

export default function CalendarInstructionsModal({
  isOpen,
  onClose,
  calendarUrl
}: CalendarInstructionsModalProps) {
  const copyUrl = async () => {
    await navigator.clipboard.writeText(calendarUrl);
    toast.success('URL copiada al portapapeles');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full sm:max-w-lg rounded-lg bg-white p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Suscribirse al Calendario
          </Dialog.Title>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">Google Calendar</h3>
              <ol className="mt-2 list-decimal list-inside text-sm text-gray-600">
                <li>Abre Google Calendar</li>
                <li>En el panel izquierdo, junto a "Otros calendarios", haz clic en el "+"</li>
                <li>Selecciona "Desde URL"</li>
                <li>Pega la URL del calendario y haz clic en "Añadir calendario"</li>
              </ol>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Apple Calendar</h3>
              <ol className="mt-2 list-decimal list-inside text-sm text-gray-600">
                <li>Abre la aplicación Calendario</li>
                <li>Ve a Archivo → Nueva suscripción a calendario</li>
                <li>Pega la URL del calendario y haz clic en "Suscribirse"</li>
              </ol>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Outlook</h3>
              <ol className="mt-2 list-decimal list-inside text-sm text-gray-600">
                <li>Abre Outlook Calendar</li>
                <li>Ve a "Añadir calendario" → "Desde Internet"</li>
                <li>Pega la URL del calendario y haz clic en "Importar"</li>
              </ol>
            </div>

            <div className="mt-4 bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-600 mb-2">URL del calendario:</div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={calendarUrl}
                  readOnly
                  className="flex-1 text-sm bg-white border border-gray-300 rounded-md px-3 py-2 min-w-0"
                />
                <Button onClick={copyUrl} variant="secondary" size="sm" className="flex items-center justify-center gap-1 w-full sm:w-auto">
                  <Copy className="w-4 h-4" />
                  <span className="sm:hidden">Copiar URL</span>
                  <span className="hidden sm:inline">Copiar</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 