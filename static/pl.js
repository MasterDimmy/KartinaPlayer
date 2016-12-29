/* * * * * * * * * * * * * * * * *
 *	Фабрика создания плеера	     *
 * * * * * * * * * * * * * * * * *
		
Параметры для фабрики:
{
	server_url: "https://rustvt.kartina.tv"
}

Использование:

	//создали плеер 
	var player = new KartinaPlayerFactory({server_url: "https://rustvt.kartina.tv"});

	//показали там, где сказано
	document.body.appendChild(player.div());


===== КИШКИ ФАБРИКИ ====

Свойства создаваемого плеера: {
	server_url: "https://rustvt.kartina.tv"
	name = "kartinaPlayer12";
}

Методы: 
Вызываются снаружи:
	.div()						-- получить собранный div объекта
	
Внутренние:
	.logon()					-- выполнить логон с введенными на форме значениями
	.account()					-- получить информцию об текущем аккаунте
	.stop()						-- стоп
	.play(channel_id)			-- запуск канала
	.pause()					-- пауза/плей
	.channels()					-- получить в массив список id каналов
	.catchup(channel_id)		-- получить архив по каналу
	.getSettings()				-- получить настройки
	.setSettings()				-- утановить настройки

*/

'use strict';
// ========================================== ФАБРИКА СОЗДАНИЯ JSONP помощника ==============================================================================
// jsonp помощник решения CORS проблемы
// на входе url для GET запроса с указанием метода callback, который должен получить ответ
// пример использования:
// var helper = new JsonpHelper(url, func).run();
// *url не должен содержать callback в своем теле!

function JsonpHelper(url, callback) {
	var prototypes = {
		on_callback: function(val) {	
			this.callback(val);
		},

		run: function(src) {
			if (src.indexOf("?") == -1) src += "?";
			if (src.indexOf("?") !== -1) src += "&";
			src += "callback="+this.constructor.name+".on_callback";
			
			var elem = document.createElement("script");
			elem.src = src;
			document.head.appendChild(elem);
		}
	};
	
	// ------------------------------------------ собираем помощника --------------------------------------------------------------
	//возвращаемый объект 
	var helper = {};
	
	//кого вызываем с результатом?
	helper.callback = callback;
		
	//методы
	for (var method in prototypes) {					
		helper.prototype[method] = prototype[method];
	}
		
	return helper;
}

// ========================================== ФАБРИКА СОЗДАНИЯ ПЛЕЕРА ==============================================================================
function KartinaPlayerFactory(properties) {
	var prototypes = {
		// ------------------------------------------ logon --------------------------------------------------------------
		//делаем logon, возвращаем true/false
		logon: function() {},
		
		// ------------------------------------------ play --------------------------------------------------------------
		//запуск проигрывания канала
		play: function() {},
		
		// ------------------------------------------ build --------------------------------------------------------------
		//запуск построения плеера
		build: function() {
			angular.module(this.name,
				[
					"ngSanitize",
					"com.2fdevs.videogular",
					"com.2fdevs.videogular.plugins.controls",
					"com.2fdevs.videogular.plugins.overlayplay",
					"com.2fdevs.videogular.plugins.poster",
					"com.2fdevs.videogular.plugins.buffering",
					"com.2fdevs.videogular.plugins.hls"
				]
			)
			.controller('HomeCtrl',
				["$sce", "$timeout", function ($sce, $timeout) {
					var controller = this;
					controller.state = null;
					controller.API = null;
					controller.currentVideo = 0;

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
					
					controller.getVideoLink = function(id) {
						var params = [];
						params["cid"] = id;
						controller.doGet(server_url + "/api/json/get_url", params, function(out){
							if (typeof out.url !== 'undefined') {
								var url = out.url;
								
								// начало блока, который требуется только при проксировании через localhost			
								if (url.indexOf("http/ts://")==0) {
									url = "http://" + url.substr(10,url.length-10);
								};
								// -------

								//alert(url);

								var new_src = [
									{src: $sce.trustAsResourceUrl(url), type: "application/x-mpegURL"}
									//{src: url, type: "application/x-mpegURL"}
								];
																		
								controller.config.sources = new_src; //controller.videos[0].sources;
								$timeout(controller.API.play.bind(controller.API), 100);
								$('.nav-tabs a[href="#panel2"]').tab('show');
							}
						});
					}

					controller.setVideo = function(index) {
						//controller.API.clearMedia();
						controller.set_config();
						controller.getVideoLink(index);
					};
					
					controller.logout = function() {
						document.getElementById('showErrors').innerHTML = "";
						$('.nav-tabs a[href="#panel1"]').tab('show');	
					};
					
					controller.show_playlist = function() {
						$('.nav-tabs a[href="#panel3"]').tab('show');	
					}
					
					controller.show_config = function() {
						$('.nav-tabs a[href="#panel4"]').tab('show');	
						document.getElementById('showErrorsCfg').innerHTML = "";
					}
					
					controller.set_config = function() {
						var param = {
							var: "stream_standard",
							val: document.getElementById('format').value
						};
						controller.doGet(server_url + "/api/json/settings_set", param, function(out) {
							controller.show_playlist();
						});
					}			
								
					controller.doPost = function(urlstr, formData, func) {
						controller.doGet(urlstr, formData, func);				
					};
					
					controller.doGet = function(urlstr, formData, func) {
						on_callback = func;
						var params = "";
						var was_here = 0;
						if (formData!==null || urlstr[-1] !== '?') params += "?";				
						for (var key in formData) {
							if (was_here>0) params += "&";	
							
							params += key + "=" + formData[key];
							was_here++;
						}	
						addScript(urlstr + params+'&callback=jsonp_get');
					};
					
					controller.unixToLocal = function(tm) {
						// Create a new JavaScript Date object based on the timestamp
						// multiplied by 1000 so that the argument is in milliseconds, not seconds.
						var date = new Date(unix_timestamp*1000);
						// Hours part from the timestamp
						var hours = date.getHours();
						// Minutes part from the timestamp
						var minutes = "0" + date.getMinutes();
						// Seconds part from the timestamp
						var seconds = "0" + date.getSeconds();

						// Will display time in 10:30:23 format
						var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
						return formattedTime;
					}

					
					controller.doLogin = function(index) {
						document.getElementById('showErrors').innerHTML = "<p class='white'>Входим...</p>";
					
						var login = document.getElementById('user_login').value;
						var pass = document.getElementById('user_pass').value;
						
						new Fingerprint2().get(function(result, components){
							var formData = {
								login: login,
								pass:  pass,
								softid: "web-ktv-002",
								cli_serial: "some_val"
							};	
							
							//1. делать вызов account перед login   &settings=1 
							//если там есть hls то все работает					
							//2. если не прошел аккаунт то логин
							//3. аккаунт для получения настроек для проверки хлс
							//4. если есть текущий хлс то ничего, если не стоит, то там же смотрю 
							//http://rustvt.kartina.tv/api/json/account?settings=1
							//http://rustvt.kartina.tv/api/json/logout
							//5. проставляю настройки
							
							controller.doPost(server_url + "/api/json/login", formData, function(out) {
								set_video = controller.setVideo;
								if (typeof out.sid !== 'undefined') {
										controller.doGet(server_url + "/api/json/channel_list", null, function(out){
											if (typeof out.groups !== 'undefined') {
												controller.playlist = out;
												
												document.getElementById('playlist_group_names').innerHTML = "";
												document.getElementById('playlist_group_channels').innerHTML = "";
												var inner_group_names = "";
												var playlist_group_channels = "";
												//заполняем названия групп (табы)
												for (var i=0; i<out.groups.length; i++) {
													var g = out.groups[i];
													var group_name = out.groups[i].name;
													inner_group_names += "<li><a data-toggle='tab' href='#group_ch"+i+"'>"+group_name+"</a></li>";
													var ch_num = 1;
													playlist_group_channels += "<div id='group_ch"+i+"' class='tab-pane fade'><ol>";
													for (var j=0; j<g.channels.length; j++) {
														var ch = g.channels[j];
														var progname = "";
														if (typeof ch.epg_progname !== 'undefined') {
															progname = " ("+ch.epg_progname+")";
														};
														
														if (ch.is_video==0) continue;
														
														playlist_group_channels += "<li><a onclick='set_video("+ch.id+");'>"+ch_num+". <b>"+ch.name+"</b>"+progname+"</a></p></li>";
														ch_num++;
														 //
													};
													playlist_group_channels += "</ol></div>";
												};
												document.getElementById('playlist_group_channels').innerHTML = playlist_group_channels;
												document.getElementById('playlist_group_names').innerHTML = inner_group_names;
												controller.show_playlist();
											} else {
												//console.log(out);
												var outstr = JSON.stringify(out);
												document.getElementById('showErrors').innerHTML = outstr;
											};
										});
								} else {
									//console.log(out);
									var outstr = JSON.stringify(out);
									document.getElementById('showErrors').innerHTML = outstr;
								}
							});
						});
					};
				}]
			); //controller
		},
		
		// ------------------------------------------ div --------------------------------------------------------------
		// получить собранный div объекта
		div: function() {
			var div = document.createElement('div');
			div.innerHTML = `
	<div ng-app=${this.name}>
	<div ng-controller="HomeCtrl as controller">

		<ul class="nav nav-tabs hide">
			<li class="active"><a data-toggle="tab" href="#panel1">Форма логона</a></li>
			<li><a data-toggle="tab" href="#panel2">Плеер</a></li>
		    <li><a data-toggle="tab" href="#panel3">Плейлист</a></li>
			<li><a data-toggle="tab" href="#panel4">Настройки</a></li>
		</ul>
		 
		<div class="tab-content">
			<div id="panel1" class="tab-pane fade in active">
				<div class="videogular-container black">
					<br><br><br> <!-- FIX ME, im not a designer =( -->
					<div class="logon">
						<div class="input-group">
							<span class="input-group-addon" id="basic-addon1">KARTINA<br>LOGO</span>
							<input id="user_login" type="text" class="form-control" placeholder="Логин" aria-describedby="basic-addon1" value="857957">
							<input id="user_pass" type="text" class="form-control" placeholder="Пароль" aria-describedby="basic-addon1" value="846690">
						</div>
						<div align="right"> <button ng-click="controller.doLogin();" type="button" class="btn btn-default">Войти</button> </div>
						<p id="showErrors"></p>
					</div>					
				</div>
		  </div>
		  <div id="panel2" class="tab-pane fade">
				<div class="videogular-container">
					<videogular vg-player-ready="controller.onPlayerReady($API)" vg-complete="controller.onCompleteVideo()" vg-theme="controller.config.theme.url">
						<vg-media vg-src="controller.config.sources" vg-hls
								  vg-tracks="controller.config.tracks">
						</vg-media>

						<vg-controls>
							<vg-play-pause-button></vg-play-pause-button>
							<vg-time-display>{{ currentTime | date:'mm:ss':'+0000' }}</vg-time-display>
							<vg-scrub-bar>
								<vg-scrub-bar-current-time></vg-scrub-bar-current-time>
							</vg-scrub-bar>
							<vg-time-display>{{ timeLeft | date:'mm:ss':'+0000' }}</vg-time-display>
							<vg-volume>
								<vg-mute-button></vg-mute-button>
								<vg-volume-bar></vg-volume-bar>
							</vg-volume>
							<vg-fullscreen-button></vg-fullscreen-button>
								<div class="my-button iconButton"><a ng-click="controller.show_config();" target="_blank">Настройки</a></div>
								<div class="my-button iconButton"><a ng-click="controller.show_playlist();" target="_blank">Плейлист</a></div>
								<div class="my-button iconButton"><a ng-click="controller.logout();"  target="_blank">Выход</a></div>
						</vg-controls>

						<vg-overlay-play></vg-overlay-play>
						<vg-buffering></vg-buffering>
						<vg-poster vg-url="controller.config.plugins.poster"></vg-poster>
					</videogular>
				</div>
		  </div>
		  <div id="panel3" class="tab-pane fade">
				<div class="videogular-container">
					<div class="playlist scroll" id="playlist">					
						<ul class="nav nav-tabs" id="playlist_group_names">
							<li class="active"><a data-toggle="tab" href="#group_ch1">group_ch1</a></li>
							<li><a data-toggle="tab" href="#group_ch2">group_ch2</a></li>
						</ul>
						<div class="tab-content" id="playlist_group_channels" ng-click="chooseChannel($event)">
							<div id="group_ch1" class="tab-pane fade">
								
							</div>
							<div id="group_ch2" class="tab-pane fade">
							</div>						
						</div>
					</div>		
				</div>
		  </div>
		  <div id="panel4" class="tab-pane fade">
			<div class="logon">
				<p>Формат вещания (http_h264, dash_hevc, hls_h264, udt_h264)</p> 
				<input id="format" type="text" class="form-control" placeholder="Формат вещания" aria-describedby="basic-addon1" value="hls_h264">
				<button ng-click="controller.set_config();" type="button" class="btn btn-default">Установить</button>
				<p id="showErrorsCfg"></p>
			</div>
		  </div>
		</div>

	</div>
	</div>		
`;	
		return div;
		} //div		
		
	};	//имена прототипов методов
		

	// ------------------------------------------ собираем плеер --------------------------------------------------------------
	//возвращаемый объект плеера
	var player = Object.create(null);
		
	//свойства		
	player.server_url = properties.server_url;		
	player.name = "player"+Date.now();
		
	//методы
	player.prototype = prototypes;
	
	return player;
};

// ================================================== вспомогательные элементы ================================================================================
// текущий таймштамп
if (!Date.now) {
	Date.now = function() { return new Date().getTime(); }
};

//dump
function dump(a) {
	var str = JSON.stringify(a, null, 4);
	console.log(str);
}
