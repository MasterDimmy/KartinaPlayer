package main

import (
	"fmt"
)

var static string = "./static"
var port int = 7075

func main() {
	err := createWebServer()
	if err != nil {
		fmt.Println("ERROR: " + err.Error())
		return
	}
	return
}
