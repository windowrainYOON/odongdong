import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

import { AlertController, ModalController } from '@ionic/angular';

import { Geolocation } from '@capacitor/geolocation';
import { BathroomService } from 'src/app/services/bathroom/bathroom.service';
import { AddBathroomComponent } from 'src/app/modals/add-bathroom/add-bathroom.component';

declare let kakao;

const myIconUrl = '../assets//svg/map/current-location.svg';
const iconUrl = '../assets/svg/map/map-marker.svg';
const clickedIconUrl = '../assets/svg/map/marker-clicked.svg';
const addIconUrl = '../assets/svg/map/add-new.svg'

@Component({
  selector: 'app-main',
  templateUrl: 'main.page.html',
  styleUrls: ['main.page.scss']
})

export class MainPage implements OnInit {
  @ViewChild('detailContainer') detailContainer: ElementRef<HTMLElement>;

  map: any;

  public initLatitude = 37.540372;
  public initLongitude = 127.069276;
  public currentLat: number;
  public currentLng: number;

  // public locationSubscription: any;

  public bathroomList = [];
  public bathroomInfo: any;
  
  public defaultMarkerIcon: any;
  public clickedMarkerIcon: any;
  public addMarkerIcon: any;

  public markerClicked = false;
  public selectedMarker = null;
  public addMarker: any;

  constructor(
    public bathroomService: BathroomService,
    public alertController: AlertController,
    public modalController: ModalController,
    public changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit() {
  }
  
  ngAfterViewInit() {
    this.createMap();
  }
  
  ionViewDidEnter() {    
    setTimeout(() => {
      this.checkPermissions()
        .then(() => {
            this.getBathroomList();
          });
    }, 300);
    // this.trackLocation();
  }

  async getBathroomList() {
    const response = await this.bathroomService.get1kmBathroomList(this.currentLat, this.currentLng);
    if(response.status === 200) {
      this.bathroomList = response.data;
      console.log('bathroom', this.bathroomList);

      //TODO: 카메라 이동
      this.moveToCurrentLocation(this.currentLat, this.currentLng);

      //add markers
      this.addMarkers();  
    } else {
      console.log('fail to get list');
    }
  }

  moveToCurrentLocation(lat, lng) {
    const currentLocation = new kakao.maps.LatLng(lat, lng);
    
    this.map.panTo(currentLocation);
  }

  createMap() {
    setTimeout(() => {
      kakao.maps.load(() => {
        //맵 생성 -> 카메라의 중앙, 확대 정도 지정
        const options = {
            center: new kakao.maps.LatLng(this.initLatitude, this.initLongitude),
            level: 4
        };

        const mapRef = document.getElementById('map');
        this.map = new kakao.maps.Map(mapRef, options);        

        this.setMarkerImages();

        //맵 클릭 이벤트 리스너 (좌클릭)
        kakao.maps.event.addListener(this.map, 'click', () => {
          //클릭된 마커와, 추가하기 마커를 (존재한다면) 삭제한다.
          this.markerClicked = false;
          if(this.addMarker) {
            this.addMarker.setMap(null);
          }

          if(this.selectedMarker) {
            this.selectedMarker.setImage(this.defaultMarkerIcon);
          }

          this.modalController.getTop()
            .then((v) => {
              v? this.modalController.dismiss(): {}
            });
        });

        //맵 클릭 이벤트 리스너 (우클릭)
        kakao.maps.event.addListener(this.map, 'dblclick', (mouseEvent) => {
          this.markerClicked = false;
          if(this.addMarker) {
            this.addMarker.setMap(null);
          }
          
          //TODO: show adding marker on map, and show component when click marker
          const currentLocation = mouseEvent.latLng;
          // this.addMarker.setPosition(currentLocation);

          console.log('dblclick', currentLocation.getLat(), currentLocation.getLng());
          
          this.addMarker = new kakao.maps.Marker({
            map: this.map,
            position: new kakao.maps.LatLng(currentLocation.getLat(), currentLocation.getLng()),
            image: this.addMarkerIcon,
          });

          kakao.maps.event.addListener(this.addMarker, 'click', () => {
            //show add bathroom component
            this.showAddBathroomModal(currentLocation.getLat(), currentLocation.getLng());
          });

        });
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
    this.defaultMarkerIcon = new kakao.maps.MarkerImage(
      iconUrl,
      new kakao.maps.Size(25, 25),
      {
        alt: 'marker img',
      }
    );

    this.clickedMarkerIcon = new kakao.maps.MarkerImage(
      clickedIconUrl,
      new kakao.maps.Size(70, 70),
      {
        offset: new kakao.maps.Point(35, 52),
        alt: 'marker img',
      }
    );

    this.addMarkerIcon = new kakao.maps.MarkerImage(
      addIconUrl,
      new kakao.maps.Size(70, 70),
      {
        // offset: new kakao.maps.Point(35, 52),
        alt: 'marker img',
      }
    );
  }

  addMarkers() {
    this.bathroomList.forEach((place) => {
      const marker = new kakao.maps.Marker({
          map: this.map,
          position: new kakao.maps.LatLng(place.longitude, place.latitude),
          image: this.defaultMarkerIcon
      });

      //detail component를 위한 값 세팅
      marker.bathroomInfo = this.genBathroomInfo(place);
      
      marker.setMap(this.map);

      //마커 클릭 리스너
      kakao.maps.event.addListener(marker, 'click', () => {
        this.bathroomInfo = marker.bathroomInfo;        

        //마커 클릭 시 카메라 이동 정의
        const cameraMov = this.getCameraMovement(this.map.getLevel());
        const movedLocation = new kakao.maps.LatLng(place.longitude-cameraMov, place.latitude);        
        this.map.panTo(movedLocation);


        //클릭된 마커가 없는 경우 -> 초기이므로, selectedMarker 값을 설정해 줘야 한다.
        if(!this.markerClicked) {
          this.markerClicked = true;
          this.selectedMarker = marker;
          marker.setImage(this.clickedMarkerIcon);
        }
  
        //클릭된 마커가 현재 마커가 아닌 경우
        if(this.selectedMarker !== marker) {
          this.markerClicked = false;
          this.changeDetectorRef.detectChanges();

          //새로 클릭된 마커는 이미지를 변경한다.
          marker.setImage(this.clickedMarkerIcon);
  
          //기존에 선택되어 있는 마커는 기본으로 바꾼다.
          this.selectedMarker.setImage(this.defaultMarkerIcon);

          this.markerClicked = true;
          this.changeDetectorRef.detectChanges();
        }
        
        //현재 클릭된 마커를 선택된 마커로 업데이트한다.
        this.selectedMarker = marker;

      });
    });
  }

  getCameraMovement(level) {
    const levels = [0.00035, 0.0007, 0.0013, 0.003, 0.005, 0.01];
    
    if(level > 7) {
      return 0.01;
    } else {
      return levels[level-1];
    }
  }

  async getCurrentLocation() {
    const coordinates = await Geolocation.getCurrentPosition();
    console.log('coordinates', coordinates);    

    if(coordinates.timestamp > 0) {
      await this.setLatLng(coordinates.coords);
    } else {
      await this.failGetLocationAlert();
      console.log('fail to get current location');
    }
  }

  async setLatLng(coord: any) {
    this.currentLat = coord.latitude;
    this.currentLng = coord.longitude;
  }
  
  // async trackLocation() {
  //   this.locationSubscription = await Geolocation.watchPosition(
  //     {
  //       enableHighAccuracy: true,
  //       timeout: 2000,
  //     },
  //     (position) => {
  //       console.log(this.locationSubscription);
        
  //       // this.initLatitude = position.coords.latitude;
  //       // this.initLongitude = position.coords.longitude;
  //     }
  //   );
  // }

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
      message: '위치 정보 가져오기 실패!',
      buttons: [
        {
          text: '닫기',
          handler: () => {}
        },
      ],
    });
    await alert.present();
  }

  async showAddBathroomModal(lat, lng) {
    console.log('add bathroom modal', lat, lng);
    
    const modal = await this.modalController.create({
      component: AddBathroomComponent,
      componentProps: {
        lat: lat,
        lng: lng
      },
      showBackdrop: false,
      canDismiss: true,

      breakpoints: [0, 0.5, 0.75],
      initialBreakpoint: 0.75,
      backdropDismiss: false,
      backdropBreakpoint: 0.75,
    });
    await modal.present();
  }

  genBathroomInfo(data) {
    const info = {
      title: data.title,
      // rating: data.rating, //서버 구현중
      isLocked: data.isLocked,
      imageUrl: data.imageUrl,
      // isOpen: data.isOpen, //서버 구현중
      // operationTime: data.operationTime //서버 구현중
      address: data.address + ' ' + data.addressDetail,
    }
    
    return info;
  }

}
