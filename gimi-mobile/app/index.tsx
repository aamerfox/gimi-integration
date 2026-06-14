import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function Index() {
    const { accessToken } = useAuthStore();
    
    if (accessToken) {
        return <Redirect href="/(tabs)" />;
    }
    return <Redirect href="/login" />;
}
