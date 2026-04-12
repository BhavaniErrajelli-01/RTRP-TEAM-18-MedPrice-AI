import { supabase } from './supabase';

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }
};

const getCurrentUser = async () => {
    requireSupabase();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    if (!user) {
        throw new Error('Please sign in first.');
    }

    return user;
};

export const getProfile = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('users')
        .select('id, email, created_at')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return (
        data || {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
        }
    );
};

export const addSearchHistory = async (medicineName) => {
    const user = await getCurrentUser();

    const { error } = await supabase.from('search_history').insert({
        user_id: user.id,
        medicine_name: medicineName,
    });

    if (error) {
        throw error;
    }
};

export const getSearchHistory = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', user.id)
        .order('searched_at', { ascending: false })
        .limit(20);

    if (error) {
        throw error;
    }

    return data || [];
};

export const saveMedicine = async (medicineName) => {
    const user = await getCurrentUser();

    const { error } = await supabase.from('saved_medicines').upsert(
        {
            user_id: user.id,
            medicine_name: medicineName,
        },
        {
            onConflict: 'user_id,medicine_name',
        }
    );

    if (error) {
        throw error;
    }
};

export const getSavedMedicines = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('saved_medicines')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
};

export const createNotification = async (medicineName, targetPrice) => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: user.id,
            medicine_name: medicineName,
            target_price: targetPrice,
        })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const getNotifications = async () => {
    const user = await getCurrentUser();

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
};

export const markNotificationAsSent = async (notificationId) => {
    const user = await getCurrentUser();

    const { error } = await supabase
        .from('notifications')
        .update({ is_active: false })
        .eq('id', notificationId)
        .eq('user_id', user.id);

    if (error) {
        throw error;
    }
};

export const getAlternatives = async (medicineName) => {
    requireSupabase();

    const { data, error } = await supabase
        .from('alternatives')
        .select('*')
        .ilike('medicine_name', `%${medicineName}%`)
        .limit(8);

    if (error) {
        throw error;
    }

    return data || [];
};

export const getPriceLogs = async (medicineName) => {
    requireSupabase();

    const { data, error } = await supabase
        .from('price_logs')
        .select('*')
        .ilike('medicine_name', `%${medicineName}%`)
        .order('timestamp', { ascending: false })
        .limit(10);

    if (error) {
        throw error;
    }

    return data || [];
};

export const getPriceLogsForMedicines = async (medicineNames) => {
    requireSupabase();

    const names = [...new Set((medicineNames || []).filter(Boolean))];
    if (!names.length) {
        return [];
    }

    const { data, error } = await supabase
        .from('price_logs')
        .select('*')
        .in('medicine_name', names)
        .order('timestamp', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
};

export const logPriceResults = async (medicineName, results) => {
    await getCurrentUser();

    const rows = (results || []).map((item) => ({
        medicine_name: medicineName,
        platform: item.platform,
        price: Number(item.price),
    }));

    if (!rows.length) {
        return;
    }

    const { error } = await supabase.from('price_logs').insert(rows);

    if (error) {
        throw error;
    }
};
