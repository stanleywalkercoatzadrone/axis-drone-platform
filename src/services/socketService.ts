import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD
    ? window.location.origin
    : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080');

class SocketService {
    private socket: Socket | null = null;

    connect(userId: string) {
        if (this.socket?.connected) return;

        const token = localStorage.getItem('skylens_token');

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected');
            this.socket?.emit('join:user', userId);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinReport(reportId: string) {
        this.socket?.emit('join:report', reportId);
    }

    leaveReport(reportId: string) {
        this.socket?.emit('leave:report', reportId);
    }

    on(event: string, callback: (...args: any[]) => void) {
        this.socket?.on(event, callback);
    }

    off(event: string, callback?: (...args: any[]) => void) {
        this.socket?.off(event, callback);
    }

    emit(event: string, data?: any) {
        this.socket?.emit(event, data);
    }
}

export const socketService = new SocketService();
