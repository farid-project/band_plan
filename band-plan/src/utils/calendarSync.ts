import { supabase } from '../lib/supabase';

export async function updateGroupCalendar(groupId: string, memberId: string) {
  try {
    const { data: calendarData, error: calendarError } = await supabase
      .rpc('get_group_calendar', {
        p_group_id: groupId,
        p_member_id: memberId
      });

    if (calendarError) {
      console.error('Error en RPC get_group_calendar:', calendarError);
      // Si el error es de permisos RLS, registrarlo pero no bloquear
      if (calendarError.code === '42501') {
        console.warn('Error de permisos RLS en calendarios, continuando sin generar calendario');
        return;
      }
      throw calendarError;
    }
    if (!calendarData) throw new Error('No se pudo generar el calendario');

    const finalCalendarData = calendarData.endsWith('\r\n') 
      ? calendarData 
      : calendarData + '\r\n';

    const fileName = 'calendar.ics';

    const calendarBlob = new Blob([finalCalendarData], { 
      type: 'text/calendar;charset=utf-8' 
    });
    
    const calendarFile = new File([calendarBlob], fileName, { 
      type: 'text/calendar;charset=utf-8'
    });

    const { error: uploadError } = await supabase
      .storage
      .from('calendars')
      .upload(`${groupId}/${memberId}/${fileName}`, calendarFile, {
        cacheControl: '0',
        upsert: true,
        contentType: 'text/calendar;charset=utf-8'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('calendars')
      .getPublicUrl(`${groupId}/${memberId}/${fileName}`);

    const urlWithCache = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('group_members')
      .update({ 
        calendar_url: urlWithCache,
        calendar_updated_at: new Date().toISOString()
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

  } catch (error) {
    console.error('Error updating calendar:', error);
    throw error;
  }
} 