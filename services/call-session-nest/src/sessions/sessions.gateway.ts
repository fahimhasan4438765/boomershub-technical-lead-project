import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';

interface SessionUpdatePayload {
  event: string;
  sessionId: string;
  status: string;
  businessId: string;
  updatedAt: string;
}

@WebSocketGateway({ path: '/ws/sessions' })
export class SessionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SessionsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(_client: WebSocket): void {
    this.logger.log(`Client connected (total: ${this.server.clients.size})`);
  }

  handleDisconnect(_client: WebSocket): void {
    this.logger.log(`Client disconnected (total: ${this.server.clients.size})`);
  }

  broadcastSessionUpdate(payload: SessionUpdatePayload): void {
    const data = JSON.stringify(payload);
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
