import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

import { AlertController, ModalController } from '@ionic/angular';

import { Geolocation } from '@capacitor/geolocation';

import { BathroomService } from 'src/app/services/bathroom/bathroom-service';
import { AddBathroomComponent } from 'src/app/modals/add-bathroom/add-bathroom.component';
import { KakaoMapService } from 'src/app/services/kakao-map/kakao-map-service';
import { CommonService } from 'src/app/services/common/common-service';

declare let kakao;

const myLocationIconUrl = '../assets/svg/map/current-location.svg';
const iconUrl = '../assets/svg/map/map-marker.svg';
const iconDisabledUrl = '../assets/svg/map/map-marker-disabled.svg';
const clickedIconUrl = '../assets/images/map/marker-clicked.png';
const clickedIconDisabledUrl = '../assets/images/map/marker-clicked-disabled.png';
const addIconUrl = '../assets/images/map/add-new.png';

@Component({
  selector: 'app-main',
  templateUrl: 'main.page.html',
  styleUrls: ['main.page.scss']
})

export class MainPage implements OnInit {
  @ViewChild('detailContainer') detailContainer: ElementRef<HTMLElement>;
  @ViewChild('map') map: any;

  /** 초기 위치 : 건대입구역 */
  public initLatitude = 37.540372;
  public initLongitude = 127.069276;

  public currentLat: number;
  public currentLng: number;
  public locationSubscription: any;

  public bathroomList = [];
  public bathroomInfo: any;
  
  public defaultMarkerIcon: any;
  public clickedMarkerIcon: any;
  public addMarkerIcon: any;
  public myLocationMarkerIcon: any;
  public defaultDisabledMarkerIcon: any;
  public clickedDisabledMarkerIcon: any;

  public markerClicked = false;
  public selectedMarker = null;
  public addMarker: any;
  public myLocationMarker: any;
  public markerList = [];

  public mapLevel = 4;

  constructor(
    public commonService: CommonService,
    public bathroomService: BathroomService,
    public kakaoMapService: KakaoMapService,
    public alertController: AlertController,
    public modalController: ModalController,
    public changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit() {}
  
  ngAfterViewInit() {
    this.setMarkerImages();
    this.createMap();
  }
  
  ionViewWillEnter() {    
    setTimeout(() => {
      this.checkPermissions()
        .then(() => {
            this.getBathroomList();
          })
        .then(() => {
            this.trackLocation();
          });
    }, 300);
  }


  async getBathroomList() {
    const response = await this.bathroomService.get1kmBathroomList(this.currentLat, this.currentLng);
    if(response.data.code === 1000) {
      this.bathroomList = response.data.result;            
      
      //move camera to current location
      this.moveToCurrentLocation(this.currentLat, this.currentLng);

      //add markers
      this.addMarkers();
    } else {
      await this.failToGetBathroomList();
    }
  }

  async getBathroomListPlain(isFromCurrentButton?: boolean) {
    const timeout = isFromCurrentButton? 300: 100;

    setTimeout(async () => {
      const currentCenter = this.map.getCenter();

      const response = await this.bathroomService.get1kmBathroomList(currentCenter.Ma, currentCenter.La);
      if(response.data.code === 1000) {
        this.bathroomList = response.data.result;

        this.addMarkers();
      } else {
        await this.failToGetBathroomList();
      }
    }, timeout);
  }

  moveToCurrentLocation(lat: number, lng: number) {
    const currentLocation = new kakao.maps.LatLng(lat, lng);
    this.addMyLocationMarker(currentLocation);
    this.map.panTo(currentLocation);
  }

  addMyLocationMarker(current: any) {
    this.myLocationMarker = new kakao.maps.Marker({
      map: this.map,
      position: new kakao.maps.LatLng(current.getLat(), current.getLng()),
      image: this.myLocationMarkerIcon,
    });

    this.myLocationMarker.setMap(this.map);
  }

  createMap() {
    setTimeout(() => {
      kakao.maps.load(() => {
        //맵 생성 -> 카메라의 중앙, 확대 정도 지정
        const options = {
            center: new kakao.maps.LatLng(this.initLatitude, this.initLongitude),
            level: this.mapLevel,
            disableDoubleClickZoom: true,
        };

        const mapRef = document.getElementById('map');
        this.map = new kakao.maps.Map(mapRef, options);

        //맵 클릭 이벤트 리스너 (좌클릭)
        this.mapLeftClickListener();

        //맵 클릭 이벤트 리스너 (우클릭)
        this.mapRightClickListener();

        //맵 이동 감지
        this.mapDragEndListener();
      });
    }, 300);    
  }

  async checkPermissions() {
    const permissions = await Geolocation.checkPermissions();

    if(permissions.coarseLocation === 'denied' || permissions.location === 'denied') {
      await this.permissionAlert();
    } else {
      await this.getCurrentLocation();
    }
  }

  setMarkerImages() {
    this.defaultMarkerIcon = this.kakaoMapService.createMarkerImage(
      iconUrl,
      25, 25
    );

    this.defaultDisabledMarkerIcon = this.kakaoMapService.createMarkerImage(
      iconDisabledUrl,
      25, 25
    );

    this.clickedMarkerIcon = this.kakaoMapService.createMarkerImage(
      clickedIconUrl,
      31, 43
    );

    this.clickedDisabledMarkerIcon = this.kakaoMapService.createMarkerImage(
      clickedIconDisabledUrl,
      31, 43
    );

    this.addMarkerIcon = this.kakaoMapService.createMarkerImage(
      addIconUrl,
      25, 35
    );

    this.myLocationMarkerIcon = this.kakaoMapService.createMarkerImage(
      myLocationIconUrl,
      40, 40,
      'my-loc'
    );
  }

  mapLeftClickListener() {
    kakao.maps.event.addListener(this.map, 'click', () => {
      this.resetMarkersOnMap();

      if(this.selectedMarker) {
        this.selectedMarker.getImage().Yj === clickedIconUrl? this.selectedMarker.setImage(this.defaultMarkerIcon): this.selectedMarker.setImage(this.defaultDisabledMarkerIcon);
      }

      this.commonService.closePresentModal();
    });
  }

  mapRightClickListener() {
    kakao.maps.event.addListener(this.map, 'rightclick', (mouseEvent) => {
      this.resetMarkersOnMap();
      
      const currentLocation = mouseEvent.latLng;
      
      //TODO: refactor (addmarker & addmarkers)
      this.addMarker = new kakao.maps.Marker({
        map: this.map,
        position: new kakao.maps.LatLng(currentLocation.getLat(), currentLocation.getLng()),
        image: this.addMarkerIcon,
      });

      this.addMarker.setMap(this.map);
      this.addMarker.setZIndex(20);

      //show add bathroom component
      kakao.maps.event.addListener(this.addMarker, 'click', () => {
        this.showAddBathroomModal(currentLocation.getLat(), currentLocation.getLng());
      });
    });
  }

  mapDragEndListener() {
    kakao.maps.event.addListener(this.map, 'dragend', () => {
      this.kakaoMapService.deleteAllMarkers(this.markerList);

      this.getBathroomListPlain();
    });
  }

  /** 클릭된 마커와, 추가하기 마커를 (존재한다면) 삭제한다. */
  resetMarkersOnMap() {
    this.markerClicked = false;
    if(this.addMarker) {
      this.addMarker.setMap(null);
      this.addMarker = null;
    }
  }

  //TODO: refactor (addmarker & addmarkers)
  addMarkers() {
    this.bathroomList.forEach((place) => {
      const marker = new kakao.maps.Marker({
        map: this.map,
        position: new kakao.maps.LatLng(place.latitude, place.longitude),
        image: place.isOpened==="Y"? this.defaultMarkerIcon: this.defaultDisabledMarkerIcon,
      });

      //detail component를 위한 값 세팅
      marker.bathroomInfo = this.genBathroomInfo(place);
      
      this.markerList.push(marker);
      marker.setMap(this.map);

      //마커 클릭 리스너
      this.markerLeftClickListener(marker, place);
    });
  }

  markerLeftClickListener(markerRef, place) {
    //마커 클릭 리스너
    kakao.maps.event.addListener(markerRef, 'click', () => {
      this.bathroomInfo = markerRef.bathroomInfo;        

      //마커 클릭 시 카메라 이동 정의
      const cameraMov = this.kakaoMapService.setCameraMovement(this.map.getLevel());
      const movedLocation = new kakao.maps.LatLng(place.latitude-cameraMov, place.longitude);
      this.map.panTo(movedLocation);


      //클릭된 마커가 없는 경우 -> 초기이므로, selectedMarker 값을 설정해 줘야 한다.
      if(!this.markerClicked) {
        this.markerClicked = true;
        this.selectedMarker = markerRef;

        place.isOpened === 'Y'? markerRef.setImage(this.clickedMarkerIcon) : markerRef.setImage(this.clickedDisabledMarkerIcon);
      }

      //클릭된 마커가 현재 마커가 아닌 경우
      if(this.selectedMarker !== markerRef) {
        this.markerClicked = false;
        this.changeDetectorRef.detectChanges();

        //새로 클릭된 마커는 이미지를 변경한다.
        markerRef.getImage().Yj === iconUrl? markerRef.setImage(this.clickedMarkerIcon) : markerRef.setImage(this.clickedDisabledMarkerIcon);

        //기존에 선택되어 있는 마커는 기본으로 바꾼다.
        this.selectedMarker.getImage().Yj === clickedIconUrl? this.selectedMarker.setImage(this.defaultMarkerIcon) : this.selectedMarker.setImage(this.defaultDisabledMarkerIcon);
        this.selectedMarker.setZIndex(5);

        this.markerClicked = true;
        this.changeDetectorRef.detectChanges();
      }
      
      //현재 클릭된 마커를 선택된 마커로 업데이트한다.
      this.selectedMarker = markerRef;
      this.selectedMarker.setZIndex(10);
    });
  }

  async getCurrentLocation() {
    /** todo
     * getcurrentposition이 안됐을 경우의 alert를 구현하는 조건문을 다시 구현해야 함
     * Uncaught (in promise): GeolocationPositionError: {}
     */
    try {
      const coordinates = await Geolocation.getCurrentPosition();
  
      if(coordinates.timestamp > 0) {
        await this.setLatLng(coordinates.coords);
      } else {
        await this.failGetLocationAlert();
      }
    } catch(error) {
      this.failGetLocationAlert();
    }
  }

  async setLatLng(coord: any) {
    this.currentLat = coord.latitude;
    this.currentLng = coord.longitude;
  }
  
  async trackLocation() {
    this.locationSubscription = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 3000,
      },
      (position) => {
        // console.log(position);
        
        this.currentLat = position.coords.latitude;
        this.currentLng = position.coords.longitude;
      }
    );
  }

  async permissionAlert() {
    const alert = await this.alertController.create({
      message: '위치 권한을 허용해주세요!',
      buttons: [
        {
          text: '닫기',
          handler: () => {}
        },
      ],
    });
    await alert.present();
  }

  async failGetLocationAlert() {
    const alert = await this.alertController.create({
      subHeader: '위치 정보를 가져오지 못했습니다.',
      message: '네트워크 상태를 확인하고, 새로고침을 해주세요!',
      buttons: [
        {
          text: '닫기',
          handler: () => {}
        },
      ],
    });
    await alert.present();
  }

  async failToGetBathroomList() {
    const alert = await this.alertController.create({
      subHeader: '화장실 목록을 가져오지 못했습니다.',
      message: '네트워크 상태를 확인하고, 새로고침을 해주세요!',
      buttons: [
        {
          text: '닫기',
          handler: () => {}
        },
      ],
    });
    await alert.present();
  }

  async showAddBathroomModal(lat: number, lng: number) {
    const cameraMov = this.kakaoMapService.setCameraMovement(this.map.getLevel());
    const movedLocation = new kakao.maps.LatLng(lat-cameraMov-0.001, lng);
    this.map.panTo(movedLocation);

    const modal = await this.modalController.create({
      component: AddBathroomComponent,
      cssClass: 'add-bathroom-compo',
      componentProps: {
        lat: lat,
        lng: lng
      },
      showBackdrop: false,
      canDismiss: true,

      breakpoints: [0, 0.5, 0.75, 1],
      initialBreakpoint: 0.75,
      backdropDismiss: false,
      backdropBreakpoint: 0.75,
    });
    await modal.present();
  }

  genBathroomInfo(data) {
    const info = {
      title: data.title,
      rating: data.rating,
      isLocked: data.isLocked,
      imageUrl: data.imageUrl,
      isOpened: data.isOpened,
      operationTime: data.operationTime,
      address: data.address + ' ' + data.addressDetail,
      isUnisex: data.isUnisex,
    }
    
    return info;
  }

  moveToCurrentButton() {
    const currentLocation = new kakao.maps.LatLng(this.currentLat, this.currentLng);
    this.map.panTo(currentLocation);

    this.kakaoMapService.deleteAllMarkers(this.markerList);
    this.getBathroomListPlain(true);
  }

  zoomIn() {
    this.mapLevel = this.map.getLevel();
    this.mapLevel -= 1;
    this.map.setLevel(this.mapLevel, {animate: true});
  }

  zoomOut() {
    this.mapLevel = this.map.getLevel();
    this.mapLevel += 1;
    this.map.setLevel(this.mapLevel, {animate: true});
  }

  refresh() {
    window.location.reload();
  }
}
