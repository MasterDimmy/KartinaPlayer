set_video = function(){};
//server_url = "/proxy"; //http://api.kartina.tv без последнего /
server_url = "https://rustvt.kartina.tv";

'use strict';
angular.module('myApp',
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
				controller.doGet(server_url + "/api/jsonp/get_url", params, function(out){
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
    );
	
function dump(a) {
	var str = JSON.stringify(a, null, 4); // (Optional) beautiful indented output.
	console.log(str);
}

on_callback = function(){};	
function jsonp_get(val) {	
	on_callback(val);
}

function addScript(src) {
  var elem = document.createElement("script");
  elem.src = src;
  document.head.appendChild(elem);
}