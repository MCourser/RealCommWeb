import {Injectable, OnDestroy, OnInit} from '@angular/core';
import 'rxjs/add/operator/share'
import * as Stomp  from 'stompjs'
import {Client} from "stompjs";
import {environment} from '../../environments/environment';

@Injectable()
export class WebSocketClientService{
  private client: Client;
  private messageHandler: MessageHandler;

  private heartbeatTimeout:number = 30000;
  private heartbeatInterval: number;

  public setMessageHandler(messageHandler: MessageHandler) {
    this.messageHandler = messageHandler;
  }

  public connect() {
    this.client = Stomp.over(new WebSocket(environment.websocketUrl));
    this.client.connect({}, resp=>{
      console.log('connect successfully');

      this.client.subscribe('/user/sender/principal', (resp)=>{
        this.messageHandler.onReceivePrincipalCurrentData(JSON.parse(resp.body).content);
      });
      this.client.subscribe('/user/sender/principal/changed', (resp)=>{
        this.messageHandler.onReceivePrincipalCurrentChangedData(JSON.parse(resp.body).content);
      });
      this.client.subscribe('/user/sender/principal/others', (resp)=>{
        this.messageHandler.onReceivePrincipalListData(JSON.parse(resp.body).content);
      });
      this.client.subscribe('/user/sender/principal/others/changed', (resp)=>{
        this.messageHandler.onReceivePrincipalListChangedData(JSON.parse(resp.body).content);
      });
      this.client.subscribe('/user/sender/principal/online', (resp)=>{
        this.messageHandler.onReceiveOtherPrincipalOnlineData(JSON.parse(resp.body).content);
      });
      this.client.subscribe('/user/sender/principal/offline', (resp)=>{
        this.messageHandler.onReceiveOtherPrincipalOfflineData(JSON.parse(resp.body).content);
      });
      this.client.subscribe("/user/sender/webrtc/config", (resp)=>{
        this.messageHandler.onReceiveWebrtcConfigurationData(JSON.parse(resp.body).content);
      });
      this.client.subscribe("/user/sender/call/offer", (resp)=>{
        this.messageHandler.onReceiveCallRequestData(JSON.parse(resp.body).content);
      });
      this.client.subscribe("/user/sender/call/answer", (resp)=>{
        this.messageHandler.onReceiveCallAnswerData(JSON.parse(resp.body).content);
      });
      this.client.subscribe("/user/sender/call/end", (resp)=>{
        this.messageHandler.onReceiveCallEndRequestData();
      });
      this.client.subscribe("/user/sender/call/candidate", (resp)=>{
        this.messageHandler.onReceiveCallIceCandidateRequestData(JSON.parse(resp.body).content);
      });

      this.heartbeatInterval = window.setInterval(()=>{
        this.sendHeartbeatRequest();
      }, this.heartbeatTimeout);

      this.messageHandler.onConnected()
    }, error=>{
      window.clearInterval(this.heartbeatInterval);
      this.connect();
    });
  }

  public disconnect() {
    this.client.disconnect(()=>{
      console.log('disconnect successfully');
      window.clearInterval(this.heartbeatInterval);
      this.messageHandler.onDisconnected();
    });
  }

  private sendHeartbeatRequest() {
    this.client.send('/receiver/principal/heartbeat');
  }
  public sendPrincipalProfileRequest() {
    this.client.send('/receiver/principal');
  }
  public sendOtherPrincipalsRequest() {
    this.client.send('/receiver/principal/others');
  }
  public sendChangePrincipalNicknameRequest(nickname: string) {
    this.client.send('/receiver/principal/nickname/' + nickname);
  }
  public sendWebrtcConfigurationRequest() {
    this.client.send('/receiver/webrtc/config');
  }
  public sendOfferRequest(callee, offer) {
    this.client.send('/receiver/call/offer/' + callee.name, {}, JSON.stringify(offer));
  }
  public sendAnswerRequest(calling, answer) {
    this.client.send('/receiver/call/answer/' + calling.name, {}, JSON.stringify(answer));
  }
  public sendCallEndRequest() {
    this.client.send('/receiver/call/end');
  }
  public sendIceCandidateRequest(iceCandidate) {
    this.client.send('/receiver/call/candidate', {}, JSON.stringify(iceCandidate));
  }
}

export interface MessageHandler {
  onConnected();
  onDisconnected();
  onReceiveWebrtcConfigurationData(data);
  onReceivePrincipalListData(data);
  onReceivePrincipalListChangedData(data);
  onReceivePrincipalCurrentData(data);
  onReceivePrincipalCurrentChangedData(data);
  onReceiveOtherPrincipalOnlineData(data);
  onReceiveOtherPrincipalOfflineData(data);
  onReceiveCallRequestData(data);
  onReceiveCallAnswerData(data);
  onReceiveCallEndRequestData();
  onReceiveCallIceCandidateRequestData(data);
}
