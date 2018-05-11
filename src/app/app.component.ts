import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {MessageHandler, WebSocketClientService} from "./service/web-socket-client.service";
import {MatSnackBar, MatSnackBarRef, SimpleSnackBar} from "@angular/material";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy, MessageHandler {
  @ViewChild('localVideoRef')
  public localVideoElementRef: ElementRef;
  @ViewChild('remoteVideoRef')
  public remoteVideoElementRef: ElementRef;

  public webrtcConfig: any = {};
  private peerConnection: RTCPeerConnection;
  private remoteVideoStreamRef: MediaStream;
  private localVideoStreamRef: MediaStream;

  public principalProfile = {
    name: ' ',
    nickname: ' '
  };
  public principalList = [];

  public call: any;
  private callRequestSnackBarRef: MatSnackBarRef<SimpleSnackBar>;

  constructor(
    private wsClientService: WebSocketClientService,
    private snackBar: MatSnackBar) {
  }

  public ngOnInit() {
    this.initLocalMedia();

    this.wsClientService.setMessageHandler(this);
    this.wsClientService.connect();
  }

  public ngOnDestroy() {
    this.wsClientService.disconnect();
  }

  // =================== message ===================
  public onConnected() {
    this.wsClientService.sendPrincipalProfileRequest();
    this.wsClientService.sendWebrtcConfigurationRequest();
    this.wsClientService.sendOtherPrincipalsRequest();
  }

  public onDisconnected() {
    throw new Error("Method not implemented.");
  }

  public onReceiveWebrtcConfigurationData(webrtcConfig: any) {
    this.webrtcConfig = webrtcConfig;
  }

  public onReceivePrincipalCurrentData(principalProfile: any) {
    this.principalProfile = principalProfile;
  }

  public onReceivePrincipalCurrentChangedData(principalProfile: any) {
    this.principalProfile = principalProfile;
  }

  public onReceivePrincipalListData(principalList: any) {
    this.principalList = principalList;
  }

  public onReceivePrincipalListChangedData(principalList: any) {
    this.principalList = principalList;
  }

  public onReceiveOtherPrincipalOnlineData(principal: any) {
    this.snackBar.open(principal.name + ' is online', '',{
      duration: 300,
      horizontalPosition: 'end',
      verticalPosition: 'bottom'
    });
  }

  public onReceiveOtherPrincipalOfflineData(principal: any) {
    this.snackBar.open(principal.name + ' is offline', '',{
      duration: 300,
      horizontalPosition: 'end',
      verticalPosition: 'bottom'
    });
  }

  public onReceiveCallRequestData(call: any) {
    console.log('on receive call request: ', call);

    this.setupPeerConnection();

    this.call = call;

    let from = this.call['calling'];
    let message = '呼叫：' + (from['nickname']?from['nickname']:from['name']);
    let action = '接受';
    this.callRequestSnackBarRef = this.snackBar.open(message, action,{
      duration: 30000,
      horizontalPosition: 'end',
      verticalPosition: 'bottom'
    });
    this.callRequestSnackBarRef.onAction().subscribe(()=>{
      console.log('accept call');

      this.callRequestSnackBarRef['isDoneAction'] = true;

      let offer = this.call['callingSessionDescription'];
      console.log('set remote sdp: ', offer);

      this.peerConnection.setRemoteDescription(offer);
      this.peerConnection.createAnswer((answer)=>{
        console.log('create answer successfully: ', answer);
        console.log('set local sdp: ', answer);
        this.peerConnection.setLocalDescription(answer);
        this.wsClientService.sendAnswerRequest(this.call.calling, answer);
      }, (error)=>{
        console.error('create answer failed: ', error);
        this.disposePeerConnection();
      });
    });
    this.callRequestSnackBarRef.afterDismissed().subscribe(()=>{
      if(!this.callRequestSnackBarRef['isDoneAction']) {
        console.log('Auto cancel call');
        this.endCall();
      }
    });
  }

  public onReceiveCallAnswerData(call) {
    console.log('on receive call accept request: ', call);

    this.call = call;
    let remoteSdp = this.call['calleeSessionDescription'];
    console.log('set remote sdp: ', remoteSdp);
    this.peerConnection.setRemoteDescription(remoteSdp);
  }

  public onReceiveCallEndRequestData() {
    console.log('on receive call end request: ');
    this.endCall();
  }

  public onReceiveCallIceCandidateRequestData(iceCandidate: any) {
    console.log('on receive ice candidate: ', iceCandidate);
    this.peerConnection.addIceCandidate(iceCandidate)
  }

  // =================== webrtc ===================
  public initLocalMedia() {
    let localVideoElement = this.localVideoElementRef.nativeElement;
    navigator.mediaDevices.getUserMedia({
      audio : {
        echoCancelation: true,
      },
      video : {
        width : 1280,
        height : 720
      }
    }).then((stream) => {
      console.log('create local media successfully!');
      this.localVideoStreamRef = stream;
      localVideoElement.srcObject = stream;
    });
  }

  public setupPeerConnection() {
    console.log('Setup peer connection');
    this.peerConnection = new RTCPeerConnection(this.webrtcConfig);
    this.peerConnection.onaddstream = this.onAddStream.bind(this);
    this.peerConnection.onremovestream = this.onRemoveStream.bind(this);
    this.peerConnection.onicecandidate = this.onIceCandidate.bind(this);

    this.peerConnection.addStream(this.localVideoStreamRef);
  }
  public disposePeerConnection() {
    this.call = null;
    if(this.remoteVideoStreamRef){
      this.remoteVideoStreamRef.getTracks().forEach(track=>{
        track.stop();
      });
    }
    if(this.peerConnection) {
      this.peerConnection.close();
    }
  }

  public onAddStream(event: MediaStreamEvent) {
    console.log('on add stream');
    let remoteVideoElement = this.remoteVideoElementRef.nativeElement;
    remoteVideoElement.srcObject = event.stream;
    this.remoteVideoStreamRef = event.stream;
  }
  public onRemoveStream(event: MediaStreamEvent) {
    console.log('on remote stream');
  }
  public onIceCandidate(event: RTCPeerConnectionIceEvent) {
    console.log('on ice candidate: ', event.candidate);
    this.wsClientService.sendIceCandidateRequest(event.candidate);
  }

  // =================== ui ===================
  public onChangePrincipalNickname() {
    this.wsClientService.sendChangePrincipalNicknameRequest(this.principalProfile.nickname);
  }

  public dialCall(principal) {
      this.setupPeerConnection();
      this.call = {
        calling: this.principalProfile,
        callee: principal
      };

      console.log('call to ', principal);
      this.peerConnection.createOffer((offer)=>{
        console.log("create offer successfully: ", offer);

        this.peerConnection.setLocalDescription(offer);
        this.wsClientService.sendOfferRequest(principal, offer);
        }, (error)=>{
        console.log("create offer failed: ", error);

        this.disposePeerConnection();
      });
  }

  public endCall() {
    console.log('end call')

    this.wsClientService.sendCallEndRequest()
    this.disposePeerConnection();
    if(this.callRequestSnackBarRef) {
      this.callRequestSnackBarRef.dismiss();
    }
  }
}
