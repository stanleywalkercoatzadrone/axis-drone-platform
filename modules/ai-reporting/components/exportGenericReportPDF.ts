export const exportGenericReportPDF = async (data: any) => {
    console.log('Exporting generic report PDF', data);
    return `report-${Date.now()}`;
};
