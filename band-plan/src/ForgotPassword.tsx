import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Input from './components/Input';
import Button from './components/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://bandplan.netlify.app/reset-password',
    });
    setLoading(false);
    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('¡Revisa tu correo para continuar el proceso!');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          ¿Olvidaste tu contraseña?
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
          />
          
          <Button type="submit" loading={loading} fullWidth>
            Enviar enlace
          </Button>
        </form>
        
        {message && (
          <div className={`mt-4 p-3 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}
        
        <p className="mt-4 text-center text-sm text-gray-600">
          <Link to="/login" className="text-indigo-600 hover:text-indigo-500">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}
