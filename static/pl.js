/* * * * * * * * * * * * * * * * *
 *	Фабрика создания плеера	     *
 * * * * * * * * * * * * * * * * *
		
Параметры для фабрики:
{
	server_url: "https://rustvt.kartina.tv"
}

Использование:

	//создали плеер 
	var player = new KartinaPlayerFactory({server_url: "https://rustvt.kartina.tv", autologin: true});

	//показали там, где сказано
	document.body.appendChild(player.div());


===== КИШКИ ФАБРИКИ ====

Свойства создаваемого плеера: 
{
	server_url: "https://rustvt.kartina.tv",
	autologin: true,	//если пользователь уже вошел (по кукам, то не отображать страницу входа и сразу входить)
	stored_playlist_refresh: 30  //предел времени хранения плейлиста, если прошло больше секунд, то делаем запрос, иначе возвращаем хранимый, по умолчанию равен 7
}

*/

'use strict';
// ========================================== ФАБРИКА СОЗДАНИЯ JSONP помощника ==============================================================================
// jsonp помощник решения CORS проблемы
// на входе url для GET запроса с указанием метода callback, который должен получить ответ
// пример использования:
// var helper = JsonpHelper().run(url, params, func);
// *url не должен содержать callback в своем теле!

var GeneralJsonpHelperCallback = function() {};
function JsonpHelper() {
	var helper = {	
		on_callback: function(val) {	
			GeneralJsonpHelperCallback(val);
		},

		run: function(src, parameters, callback) {
			GeneralJsonpHelperCallback = callback;
			
			if (src.indexOf("?") == -1) src += "?";
			else if (src.indexOf("?") !== -1) src += "&";
			
			var params = "";
			var was_here = 0;
			for (var key in parameters) {
				if (was_here>0) params += "&";	
				params += key + "=" + parameters[key];
				was_here++;
			}
			if (was_here>0) src += params+"&";						
			src += "callback=GeneralJsonpHelperCallback";			
			
			console.log("run jsonp ["+src+"]");
			
			var elem = document.createElement("script");
			elem.src = src;
			document.head.appendChild(elem);
		}
	};
			
	return helper;
}

// ========================================== ФАБРИКА СОЗДАНИЯ ПЛЕЕРА ==============================================================================
var GeneralKartinaPlayer = null;
function KartinaPlayerFactory(properties) {
	//создадим помощника
	var new_helper = JsonpHelper();
	
	//управление вкладками
	var pager = {
		show_logon: function() {
			this.display_atlogon_info("");			
			//console.log("Переход на главную форму");	
			$('.nav-tabs a[href="#player_logon"]').tab('show');			
		},	
		show_playlist: function() {
			if (this.current_video_id !== -1)
				this.controller.API.pause();
			//console.log("Начинаем показывать плейлист");	
			$('.nav-tabs a[href="#player_playlist"]').tab('show');
		},	
		show_player: function() {
			//console.log("Показываем плеер");
			$('.nav-tabs a[href="#player_view"]').tab('show');						
		}
	};

	//база плеера
	var player = {
		//КОНФИГУРИРУЕМЫЕ ЗНАЧЕНИЯ
		server_url: properties.server_url,	
		autologin: (properties.autologin !== undefined) ? (properties.autologin) : false,
		stored_playlist_refresh: (properties.stored_playlist_refresh !== undefined) ? (properties.stored_playlist_refresh) : 7, 
		
		//ВНУТРЕННИЕ СВОЙСТВА
		helper: new_helper, 		//загрузчик jsonp
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
		
		// ------------------------------------------ display_atlogon_info --------------------------------------------------------------
		display_atlogon_info: function(text) {
			document.getElementById('showErrors').innerHTML = "<p class='white'>"+text+"</p>";
		},
		
		// ------------------------------------------ check_server_error --------------------------------------------------------------
		//проверка ответа сервера на наличие ошибок
		check_server_error: function(data) {
			if (data.error !== undefined) {
				return { error: true, code: data.error.code, message: data.error.message }
			};
			return { error: false };
		},

		// ------------------------------------------ загрузка плейлиста --------------------------------------------------------------
		//загрузка плейлиста (делаем действительную загрузку не чаще, чем раз в 6 секунд)
		onload_playlist: function(data) {
			var pl = GeneralKartinaPlayer;
			console.log("onload_playlist");
			//проверяем что все хорошо
			var cse = pl.check_server_error(data);
			if (cse.error) { //сервер вернул ошибку
				if (pl.first_login) { //когда попали сюда первый раз, ошибка могла быть что мы не залогонились
					pl.first_login = false;
					pl.login();	//1.1. делаем попытку входа с введенными значениями
				} else {
					console.log("Критическая ошибка. Код: "+cse.code+" Текст: "+cse.message);
					pl.display_atlogon_info("Критическая ошибка. Код: "+cse.code+" Текст: "+cse.message);
				};
			} else {	
				if (typeof data.groups !== 'undefined') {
					//сохраняем плейлист и таймштамп его получения
					pl.stored_playlist = data;
					pl.stored_playlist_time = Date.now();
										
					document.getElementById('playlist_group_names').innerHTML = "";
					document.getElementById('playlist_group_channels').innerHTML = "";
					var inner_group_names = "";
					var playlist_group_channels = "";
					//заполняем названия групп (табы)
					for (var i=0; i<data.groups.length; i++) {
						var g = data.groups[i];
						var group_name = data.groups[i].name;
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
							
							playlist_group_channels += "<li><a onclick='GeneralKartinaPlayer.set_video("+ch.id+");'>"+ch_num+". <b>"+ch.name+"</b>"+progname+"</a></p></li>";
							ch_num++;
						};
						playlist_group_channels += "</ol></div>";
					};
					document.getElementById('playlist_group_channels').innerHTML = playlist_group_channels;
					document.getElementById('playlist_group_names').innerHTML = inner_group_names;
					
					pl.show_playlist();
				} else {
					console.log("Отсутствуют каналы: "+out);
					pl.display_atlogon_info("Критическая ошибка. Отсутствуют каналы!");
				};						
			};
		},
		
		// ------------------------------------------ загрузка плейлиста --------------------------------------------------------------
		//загрузка плейлиста (делаем действительную загрузку не чаще, чем раз в _указано_ секунд)
		load_playlist: function() {
			var pl = GeneralKartinaPlayer;
			console.log("load_playlist");
			pl.display_atlogon_info("Загрузка плейлиста...");			
			var now = Date.now();
			console.log("now="+now+" old="+pl.stored_playlist_time+" ref="+pl.stored_playlist_refresh);
			if ((now - pl.stored_playlist_time) > pl.stored_playlist_refresh) { //обновляем плейлист ?
				console.log("need refresh playlist");
				pl.helper.run(pl.server_url+"/api/json/channel_list", null, pl.onload_playlist);
			} else { // используем старый
				console.log("use old playlist");
				pl.show_playlist();
			};
		},
		
		// ------------------------------------------ set_video --------------------------------------------------------------
		//запуск вещания указанного канала
		on_set_video: function(data) {
			var pl = GeneralKartinaPlayer;
			
			//проверяем что все хорошо
			var cse = pl.check_server_error(data);
			if (cse.error) { //сервер вернул ошибку
				if (pl.first_login) { //когда попали сюда первый раз, ошибка могла быть что мы не залогонились
					pl.first_login = false;
					pl.login();	//1.1. делаем попытку входа с введенными значениями
				} else {
					console.log("Критическая ошибка. Код: "+cse.code+" Текст: "+cse.message);
					pl.display_atlogon_info("Критическая ошибка. Код: "+cse.code+" Текст: "+cse.message);
				};
			} else {	
				if (typeof data.url !== 'undefined') {
					var url = data.url;
					
					var new_src = [
						{src: pl.controller_sce.trustAsResourceUrl(url), type: "application/x-mpegURL"}
					];
					
					var delayed_bind = function() {
						pl.controller.API.play.bind(pl.controller.API);
						
						var delayed_play = function() {
							pl.controller.API.play();
						}
						
						pl.controller_timeout(delayed_play, 2000);
					};
															
					pl.controller.config.sources = new_src; //controller.videos[0].sources;
					pl.controller_timeout(delayed_bind, 100);
					pl.show_player();
				};
			};
		},
		
		// ------------------------------------------ set_video --------------------------------------------------------------
		//запуск вещания указанного канала
		set_video: function(id) {
			if (this.current_video_id !== -1)
				this.controller.API.pause();
			this.current_video_id = id;			
			var param = [];
			param["cid"] = id;
			this.helper.run(this.server_url+"/api/json/get_url", param, this.on_set_video);
		},
		
		// ------------------------------------------ set_config --------------------------------------------------------------
		//установка настройки - формат вещания и переход на страницу плейлиста
		set_config: function() {
			console.log("set_config");
			var param = {
				var: "stream_standard",
				val: document.getElementById('format').value
			};
			this.helper.run(this.server_url+"/api/json/settings_set", param, this.load_playlist);
		},
		
		// ------------------------------------------ on_account --------------------------------------------------------------
		//1. проверка успешности входа
		on_account: function(data) {
			var pl = GeneralKartinaPlayer;
			console.log("on_account:" + data);
			if (data.servertime !== 'undefined') {
				pl.servertime = data.servertime; //отмечаем снапшоты серверного и нашего времени
				pl.currenttime = Date.now(); //текущее время
				
				var cse = pl.check_server_error(data);
				if (cse.error) { //сервер вернул ошибку
					if (pl.first_login) { //когда попали сюда первый раз, ошибка могла быть что мы не залогонились
						pl.first_login = false;
					} else {
						console.log("Критическая ошибка. Код: "+cse.code+" Текст: "+cse.message);
						pl.display_atlogon_info("Критическая ошибка. Код: "+cse.code+" Текст: "+cse.message);
					}
				} else {
					//2. проверяем, выставлен сейчас показ hls или нет
					if (data.settings !== undefined)
						if (data.settings.stream_standart !== undefined) {
							var standart = data.settings.stream_standart;
							if (standart.value !== undefined)
								if (standart.value !== 'hls_h264') {	//3. если hls не выставлен, то выставляем его
									pl.set_config();							
								};
						};
					//4. мы уже вошли, все хорошо, загружаем плейлист
					pl.load_playlist();
				};
			} else {
				pl.display_atlogon_info("Критическая ошибка входа...");		
			}			
		},
		
		// ------------------------------------------ test_login --------------------------------------------------------------
		// 1. Делаем вызов account (&settings=1) проверка что мы уже вошли
		test_login: function() {
			console.log("test_login");
			this.helper.run(this.server_url+"/api/json/account", {settings: 1}, this.on_account);
		},	
		
		// ------------------------------------------ on_logout --------------------------------------------------------------
		on_logout: function() {
			var pl = GeneralKartinaPlayer;			
			pl.display_atlogon_info("");
			pl.show_logon();
		},
		
		// ------------------------------------------ logout --------------------------------------------------------------
		logout: function() {
			if (this.current_video_id !== -1)
				controller.API.Stop();		
			this.helper.run(this.server_url+"/api/json/logout", null, this.on_logout);
		},
		
		// ------------------------------------------ logon --------------------------------------------------------------
		login: function() {
			console.log("login");
			//1. делаем новый вход в сервера
			this.display_atlogon_info("Входим...");	
			
			var login = document.getElementById('user_login').value;
			var pass = document.getElementById('user_pass').value;
			
			var formData = {
				login: login,
				pass:  pass,
				softid: "web-ktv-002",
				cli_serial: "some_val"	//TODO FIXME Ожидаем значения от Сергея
			};	
				
			this.helper.run(this.server_url+"/api/json/login", formData, this.on_account);
		},

		// ------------------------------------------ run --------------------------------------------------------------
		//запуск построения плеера
		run: function() {
			var this_obj = this;
			angular.module("KartinaPlayerApp",
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
							poster: "http://kartina.tv/media/flash/1482509620.jpg"  //KARTINA INTRO FOR PLAYER
						}
					};
					
					controller.__proto__ = this_obj;
					this_obj.controller = controller;
					this_obj.controller_sce = $sce;
					this_obj.controller_timeout = $timeout;
				}]
			); //controller
			
			//начинаем незамедлительный вход, если мы уже были залогонены
			if (this.autologin)
				this.test_login();
		} //run
	};
	
	//учим плеер управлять вкладками
	player.__proto__ = pager;
	
	GeneralKartinaPlayer = player;
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
};

//human time
function unixToLocal(tm) {
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

//вернуть глобальное имя объекта
//TODO FIXME как быстрее и проще?
function getGlobalName(a) {
	for(var n in window) if(window[n] === a) return n;
	return 'notfound';
}