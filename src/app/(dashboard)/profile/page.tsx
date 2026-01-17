import { getCurrentUserProfile } from '@/lib/actions/profile';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Separator } from '@/components/ui/separator';

export default async function ProfilePage() {
    const profile = await getCurrentUserProfile();

    if (!profile) {
        return (
            <div className="flex-1 space-y-6">
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No user profile found. Please add a user to the database.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile</h2>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>
            <Separator className="my-6" />
            
            <div className="max-w-2xl">
                <ProfileForm profile={profile} />
            </div>
        </div>
    );
}
