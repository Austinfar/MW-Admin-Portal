import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'archive'
    | 'restore'
    | 'impersonate_start'
    | 'impersonate_stop'
    | 'login'
    | 'manual_sync';

export interface AuditLogParams {
    action: AuditAction;
    targetResource: string; // e.g., 'user', 'client', 'commission_split'
    targetId: string;
    changes?: Record<string, any>;
    actorId?: string; // Optional: If not provided, will try to get from current session
}

export async function logAuditAction({ action, targetResource, targetId, changes, actorId }: AuditLogParams) {
    try {
        const supabase = await createClient();

        // If actorId not explicitly provided, try to get from session
        let finalActorId = actorId;
        if (!finalActorId) {
            const { data: { user } } = await supabase.auth.getUser();
            finalActorId = user?.id;
        }

        // We use admin client to write to audit_logs to ensure reliability regardless of current user policies
        // (Though RLS allows insert usually, using admin client ensures we don't hit policy walls for the logger itself)
        const adminClient = createAdminClient();

        const { error } = await adminClient
            .from('audit_logs')
            .insert({
                actor_id: finalActorId,
                target_resource: targetResource,
                target_id: targetId,
                action,
                changes: changes || {},
            });

        if (error) {
            console.error('Failed to write audit log:', error);
            // We do NOT throw here to avoid breaking the main user flow if logging fails
        }
    } catch (err) {
        console.error('Unexpected error in logAuditAction:', err);
    }
}
