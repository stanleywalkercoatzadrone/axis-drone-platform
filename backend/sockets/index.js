export const initializeSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`✅ Client connected: ${socket.id}`);

        // Join user-specific room
        socket.on('join:user', (userId) => {
            socket.join(`user:${userId}`);
            console.log(`User ${userId} joined their room`);
        });

        // Join report-specific room
        socket.on('join:report', (reportId) => {
            socket.join(`report:${reportId}`);
            console.log(`Socket ${socket.id} joined report ${reportId}`);
        });

        // Leave report room
        socket.on('leave:report', (reportId) => {
            socket.leave(`report:${reportId}`);
            console.log(`Socket ${socket.id} left report ${reportId}`);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });

        // Heartbeat for connection monitoring
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });

    return io;
};
