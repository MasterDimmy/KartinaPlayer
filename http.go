package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TProtoJSError struct {
	Success bool
	Message string
}

type TProtoJSSuccess struct {
	Success bool
	Items   interface{}
}

func ProtoError(w http.ResponseWriter, s string) {
	p := TProtoJSError{
		Success: false,
		Message: s,
	}
	buf, _ := json.MarshalIndent(p, "", " ")
	w.Write(buf)
}

func ProtoSuccess(w http.ResponseWriter, s interface{}) {
	p := TProtoJSSuccess{
		Success: true,
		Items:   s,
	}
	buf, _ := json.MarshalIndent(p, "", " ")
	w.Write(buf)
}

var fileServer = http.StripPrefix("/static/", http.FileServer(http.Dir(static)))

func root(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("\n%s r.Method=%s\n", r.URL.String(), r.Method)
	w.Header().Set("Cache-Control", "no-cache")
	switch r.URL.String() {
	case "/":
		http.Redirect(w, r, "/static/index.html", http.StatusMovedPermanently)
	}
	fileServer.ServeHTTP(w, r)
	fmt.Println(r.URL.String() + " not found")
	http.Error(w, "404 Page Not Found!", 404)
}

type TKartinaError struct {
	Error struct {
		Code    int
		Message string
	}
}

func proxyUrl(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("%s r.Method=%s\n", r.URL.String(), r.Method)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	timeout := time.Duration(5 * time.Second)

	client := &http.Client{Transport: tr,
		Timeout: timeout,
	}

	ur := r.URL.String()

	ur = strings.Replace(ur, "/proxy", "https://iptv.kartina.tv", -1)

	fmt.Printf("[%s]: %s\n", r.Method, ur)

	r.ParseForm()
	form := url.Values{}

	for k, v := range r.Form {
		for _, vk := range v {
			if k != "{}" {
				fmt.Printf("form k: %s v: %s\n", k, vk)
				form.Add(k, vk)
			}
		}
	}

	req, err := http.NewRequest(r.Method, ur, strings.NewReader(form.Encode()))
	if err != nil {
		fmt.Println("ERROR NewRequest: " + err.Error())
		ProtoError(w, "ERROR NewRequest: "+err.Error())
		return
	}

	for _, k := range r.Cookies() {
		req.AddCookie(k)
	}

	data, err := client.Do(req)
	if err != nil {
		fmt.Println("ERROR client.Do: " + err.Error())
		//ProtoError(w, "ERROR client.Do: "+err.Error())
		w.Write([]byte(err.Error()))
		return
	}

	for k, v := range data.Header {
		for _, vk := range v {
			w.Header().Add(k, vk)
		}
	}

	for _, k := range data.Cookies() {
		fmt.Printf("cookie name %s value %s\n", k.Name, k.Value)
		http.SetCookie(w, k)
	}

	body, err := ioutil.ReadAll(data.Body)
	if err != nil {
		fmt.Println("ERROR ReadAll: " + err.Error())
		ProtoError(w, "ERROR ReadAll: "+err.Error())
		return
	}

	data.Body.Close()

	var kartina_err TKartinaError
	err = json.Unmarshal(body, &kartina_err)
	if err != nil {
		fmt.Println("ERROR Unmarshal: " + err.Error())
		ProtoError(w, "ERROR Unmarshal: "+err.Error())
		return
	}
	if kartina_err.Error.Code != 0 {
		fmt.Println("KARTINA.TV ERROR MESSAGE: " + kartina_err.Error.Message)
		ProtoError(w, "KARTINA.TV ERROR MESSAGE: "+kartina_err.Error.Message)
		return
	}

	w.Write(body)
}

func createWebServer() error {

	http.HandleFunc("/", root)
	http.HandleFunc("/proxy/", proxyUrl)
	/*fileServer := http.StripPrefix("/static/", http.FileServer(http.Dir(static)))
	http.Handle("/static/", fileServer)*/

	fmt.Printf("Запуск Веб-сервера по адресу http://localhost:%d\nКаталог Веб-сервера: %s\n", port, static)

	err := http.ListenAndServe(fmt.Sprintf(":%d", port), nil)
	return err
}
