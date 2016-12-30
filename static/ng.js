
'use strict';

// ========================================== ФАБРИКА СОЗДАНИЯ ПЛЕЕРА ==============================================================================
var GeneralKartinaPlayer = null;
function KartinaPlayerFactory(properties) {
	
	//база плеера
	var player = {
		//КОНФИГУРИРУЕМЫЕ ЗНАЧЕНИЯ
		server_url: properties.server_url,	
		autologin: (properties.autologin !== undefined) ? (properties.autologin) : false,
		stored_playlist_refresh: (properties.stored_playlist_refresh !== undefined) ? (properties.stored_playlist_refresh) : 7, 
		
		//ВНУТРЕННИЕ СВОЙСТВА
		controller:	null,			//videogular
		controller_sce: null,		//videogular_sce
		controller_timeout: null,	//videogulat_timeout func
		first_login: true,	
		
		stored_playlist: {},		//хранимый список каналов
		stored_playlist_time:  0,	//время получения списка каналов
		
		//снапшоты времени сервер и наши, чтобы понять разницу во времени
		servertime: 0,
		currenttime: 0,
		
		current_video_id: -1,		//текущий канал
		
		// ------------------------------------------ run --------------------------------------------------------------
		//запуск построения плеера
		run: function() {
			var this_obj = this;
			angular.module("KartinaPlayerApp",
				[
					//--- Videogular
					"ngSanitize",
					"com.2fdevs.videogular",
					"com.2fdevs.videogular.plugins.controls",
					"com.2fdevs.videogular.plugins.overlayplay",
					"com.2fdevs.videogular.plugins.poster",
					"com.2fdevs.videogular.plugins.buffering",
					"com.2fdevs.videogular.plugins.hls",
					//--- ngMaterial Tabs
					'ngMaterial', 
					'ngMessages', 
					'material.svgAssetsCache'
				]
			)
			.controller('HomeCtrl',
				["$sce", "$timeout", function ($sce, $timeout) {
					var controller = this;
					controller.state = null;
					controller.API = null;
					controller.currentVideo = 0;
					
					controller.selectedTab = 0;

					controller.onPlayerReady = function(API) {
						controller.API = API;
					};

					controller.onCompleteVideo = function() {
						controller.isCompleted = true;
						controller.currentVideo++;
						if (controller.currentVideo >= controller.videos.length) controller.currentVideo = 0;
						controller.setVideo(controller.currentVideo);
					};

					controller.videos = [
					{
						sources: [  { src: "" } ]
					}];
				
					controller.playlist = {};

					controller.config = {
						preload: "none",
						autoHide: false,
						autoHideTime: 3000,
						autoPlay: false,
						sources: controller.videos[0].sources,

						theme: {
							url: "http://www.videogular.com/styles/themes/default/latest/videogular.css"
						},
						plugins: {
							poster: "http://www.videogular.com/assets/images/videogular.png"  //TODO: KARTINA LOGO
						}
					};
					
					controller.__proto__ = this_obj;
					this_obj.controller = controller;
					this_obj.controller_sce = $sce;
					this_obj.controller_timeout = $timeout;
				}]
			); //controller
			
		} //run
	};
		
	GeneralKartinaPlayer = player;
	return player;
};
