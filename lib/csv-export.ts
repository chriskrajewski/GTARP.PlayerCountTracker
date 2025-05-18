import { PlayerCountData, StreamCountData, ViewerCountData, ServerData } from "./data";

/**
 * Converts player count data to CSV format
 */
export function playerCountsToCSV(data: PlayerCountData[], servers: ServerData[]): string {
  // Create a server name lookup map
  const serverNameMap: Record<string, string> = {};
  servers.forEach((server) => {
    serverNameMap[server.server_id] = server.server_name;
  });

  // Create CSV header
  let csv = "Timestamp,Server ID,Server Name,Player Count\n";

  // Add data rows
  data.forEach((row) => {
    const serverName = serverNameMap[row.server_id] || `Server ${row.server_id}`;
    csv += `${row.timestamp},${row.server_id},"${serverName}",${row.player_count}\n`;
  });

  return csv;
}

/**
 * Converts streamer count data to CSV format
 */
export function streamerCountsToCSV(data: StreamCountData[], servers: ServerData[]): string {
  // Create a server name lookup map
  const serverNameMap: Record<string, string> = {};
  servers.forEach((server) => {
    serverNameMap[server.server_id] = server.server_name;
  });

  // Create CSV header
  let csv = "Timestamp,Server ID,Server Name,Streamer Count\n";

  // Add data rows
  data.forEach((row) => {
    const serverName = serverNameMap[row.server_id] || `Server ${row.server_id}`;
    csv += `${row.timestamp},${row.server_id},"${serverName}",${row.streamercount}\n`;
  });

  return csv;
}

/**
 * Converts viewer count data to CSV format
 */
export function viewerCountsToCSV(data: ViewerCountData[], servers: ServerData[]): string {
  // Create a server name lookup map
  const serverNameMap: Record<string, string> = {};
  servers.forEach((server) => {
    serverNameMap[server.server_id] = server.server_name;
  });

  // Create CSV header
  let csv = "Timestamp,Server ID,Server Name,Viewer Count\n";

  // Add data rows
  data.forEach((row) => {
    const serverName = serverNameMap[row.server_id] || `Server ${row.server_id}`;
    csv += `${row.timestamp},${row.server_id},"${serverName}",${row.viewcount}\n`;
  });

  return csv;
}

/**
 * Triggers CSV download in the browser
 */
export function downloadCSV(csvContent: string, fileName: string): void {
  // Create a blob with the CSV content
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  
  // Create download URL
  const url = URL.createObjectURL(blob);
  
  // Create temporary download link
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  
  // Add to document, trigger download, then clean up
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
} 