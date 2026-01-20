import { TeamSettingsClient } from '@/components/team/TeamSettingsClient';
import { protectRoute } from '@/lib/protect-route';
import { SettingsLayout } from '@/components/settings/SettingsLayout';

export default async function TeamSettingsPage() {
    await protectRoute('can_view_team_settings');

    return (
        <SettingsLayout activeTab="team">
            <div className="space-y-6">
                <TeamSettingsClient />
            </div>
        </SettingsLayout>
    );
}
