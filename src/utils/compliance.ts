import apiClient from '../services/apiClient';

/**
 * Automatically calculates and updates the compliance status of a user based on their uploaded documents.
 * @param userId - The ID of the personnel member
 */
export async function updateCompliance(userId: string) {
    try {
        // 1. Fetch user's documents
        const res = await apiClient.get(`/documents`, { params: { personnelId: userId } });
        const docs = res.data.data || [];

        // 2. Define required document types (standard enterprise compliance checklist)
        const required = ["ID", "License", "Insurance"];

        // 3. Check if all required documents are present
        const complete = required.every(reqType =>
            docs.some((doc: any) => doc.type === reqType || doc.category === reqType)
        );

        // 4. Update the personnel status globally
        await apiClient.patch(`/personnel/${userId}`, {
            compliance: complete ? "Compliant" : "Pending Docs"
        });

        console.log(`Compliance updated for ${userId}: ${complete ? "Compliant" : "Pending Docs"}`);
        return complete;
    } catch (error) {
        console.error(`Failed to update compliance for user ${userId}:`, error);
        throw error;
    }
}
